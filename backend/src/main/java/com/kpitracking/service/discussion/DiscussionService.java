package com.kpitracking.service.discussion;

import com.kpitracking.dto.request.discussion.UpdateCommentRequest;
import com.kpitracking.dto.response.discussion.DiscussionCommentResponse;
import com.kpitracking.dto.response.discussion.DiscussionLocateResponse;
import com.kpitracking.dto.response.discussion.DiscussionPageResponse;
import com.kpitracking.dto.response.discussion.MentionCandidateResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.DiscussionCommentKind;
import com.kpitracking.enums.DiscussionReactionType;
import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.enums.StorageProvider;
import com.kpitracking.event.DiscussionEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.i18n.Terms;
import com.kpitracking.mapper.DiscussionMapper;
import com.kpitracking.repository.*;
import com.kpitracking.service.CloudinaryStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Khung thảo luận dùng chung cho KPI và công việc: bình luận, trả lời một cấp, @tag, cảm xúc, tệp đính kèm,
 * sửa/xoá, đã đọc, dòng hệ thống. Quyền đi qua {@link DiscussionTargets}; mọi thay đổi phát
 * {@link DiscussionEvents.Changed} để WebSocket đẩy cho người đang mở (sau commit).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DiscussionService {

    public static final int MAX_BODY = 5000;
    private static final int DEFAULT_PAGE = 20;
    private static final int MAX_PAGE = 50;
    /** Số trả lời mới nhất đi kèm mỗi bình luận gốc; xem thêm bằng {@link #replies}. */
    private static final int INLINE_REPLIES = 3;
    private static final int MENTION_SUGGESTIONS = 20;

    private final DiscussionCommentRepository commentRepository;
    private final DiscussionAttachmentRepository attachmentRepository;
    private final DiscussionReactionRepository reactionRepository;
    private final DiscussionMentionRepository mentionRepository;
    private final DiscussionReadStateRepository readStateRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final DiscussionTargets targets;
    private final DiscussionMapper mapper;
    private final CollabAttachmentPolicy attachmentPolicy;
    private final AttachmentLibrarySources librarySources;
    private final CloudinaryStorageService storage;
    private final ApplicationEventPublisher events;

    // ── Đọc ──────────────────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public DiscussionPageResponse page(DiscussionTargetType type, UUID targetId, String cursor, Integer size) {
        User me = currentUser();
        DiscussionTargets.Target t = targets.load(type, targetId);
        targets.assertCanView(me.getId(), t);

        int lim = clamp(size);
        Cursor c = Cursor.parse(cursor);
        List<DiscussionComment> roots = commentRepository.findRootsBefore(type.name(), targetId, c.at(), c.id(), lim + 1);
        boolean hasMore = roots.size() > lim;
        if (hasMore) roots = roots.subList(0, lim);
        return pageOf(me, t, roots, true, hasMore);
    }

    /** Trang chứa đúng bình luận đích (mở từ thông báo): mọi bình luận gốc từ gốc của nó trở về sau. */
    @Transactional(readOnly = true)
    public DiscussionPageResponse around(UUID commentId) {
        User me = currentUser();
        DiscussionComment target = findComment(commentId);
        DiscussionComment root = target.getParentId() == null ? target : findComment(target.getParentId());
        DiscussionTargets.Target t = targets.load(root.getTargetType(), root.getTargetId());
        targets.assertCanView(me.getId(), t);

        List<DiscussionComment> roots = commentRepository.findRootsFrom(root.getTargetType().name(), root.getTargetId(),
                root.getCreatedAt(), root.getId(), 200);
        boolean hasMore = !commentRepository.findRootsBefore(root.getTargetType().name(), root.getTargetId(),
                root.getCreatedAt(), root.getId(), 1).isEmpty();
        DiscussionPageResponse page = pageOf(me, t, roots, true, hasMore);
        // Bình luận đích là một trả lời cũ hơn 3 trả lời mới nhất ⇒ nạp đủ trả lời của gốc đó.
        if (target.getParentId() != null) {
            List<DiscussionComment> all = commentRepository.findRepliesBefore(root.getId(),
                    DiscussionCommentRepository.NO_CURSOR_AT, DiscussionCommentRepository.NO_CURSOR_ID, 100);
            Collections.reverse(all);
            List<DiscussionCommentResponse> replies = assemble(me, t, all, false, targets.canModerate(me.getId(), t),
                    targets.canComment(me.getId(), t));
            page.getContent().stream().filter(r -> r.getId().equals(root.getId())).findFirst()
                    .ifPresent(r -> r.setReplies(replies));
        }
        return page;
    }

    /** Trả lời cũ hơn con trỏ của một bình luận gốc, mới nhất trước. */
    @Transactional(readOnly = true)
    public DiscussionPageResponse replies(UUID parentId, String cursor, Integer size) {
        User me = currentUser();
        DiscussionComment parent = findComment(parentId);
        DiscussionTargets.Target t = targets.load(parent.getTargetType(), parent.getTargetId());
        targets.assertCanView(me.getId(), t);

        int lim = clamp(size);
        Cursor c = Cursor.parse(cursor);
        List<DiscussionComment> list = commentRepository.findRepliesBefore(parentId, c.at(), c.id(), lim + 1);
        boolean hasMore = list.size() > lim;
        if (hasMore) list = list.subList(0, lim);
        return pageOf(me, t, list, false, hasMore);
    }

    @Transactional(readOnly = true)
    public DiscussionLocateResponse locate(UUID commentId) {
        User me = currentUser();
        DiscussionComment c = findComment(commentId);
        DiscussionTargets.Target t = targets.load(c.getTargetType(), c.getTargetId());
        targets.assertCanView(me.getId(), t);
        return DiscussionLocateResponse.builder()
                .commentId(c.getId())
                .rootId(c.getParentId() != null ? c.getParentId() : c.getId())
                .targetType(c.getTargetType())
                .targetId(c.getTargetId())
                .kpiId(t.kpiId())
                .build();
    }

    @Transactional(readOnly = true)
    public List<MentionCandidateResponse> mentionCandidates(DiscussionTargetType type, UUID targetId, String query) {
        User me = currentUser();
        DiscussionTargets.Target t = targets.load(type, targetId);
        targets.assertCanView(me.getId(), t);

        List<UUID> ids = targets.mentionCandidates(t, query, MENTION_SUGGESTIONS + 1).stream()
                .filter(id -> !id.equals(me.getId())).toList();
        Map<UUID, User> users = userRepository.findAllById(ids).stream().collect(Collectors.toMap(User::getId, u -> u));
        Map<UUID, String[]> roles = primaryRoles(ids);
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return ids.stream().map(users::get).filter(Objects::nonNull)
                .filter(u -> q.isEmpty() || u.getFullName().toLowerCase(Locale.ROOT).contains(q)
                        || (u.getEmail() != null && u.getEmail().toLowerCase(Locale.ROOT).contains(q)))
                .limit(MENTION_SUGGESTIONS)
                .map(u -> MentionCandidateResponse.builder()
                        .id(u.getId()).fullName(u.getFullName()).email(u.getEmail()).avatarUrl(u.getAvatarUrl())
                        .title(roles.getOrDefault(u.getId(), new String[2])[0])
                        .unitName(roles.getOrDefault(u.getId(), new String[2])[1])
                        .build())
                .toList();
    }

    /** Số bình luận chưa đọc của người dùng hiện tại trên từng đối tượng (danh sách KPI / task). */
    @Transactional(readOnly = true)
    public Map<UUID, Long> unreadCounts(UUID userId, DiscussionTargetType type, Collection<UUID> targetIds) {
        if (targetIds == null || targetIds.isEmpty()) return Map.of();
        return toCountMap(commentRepository.countUnread(userId, type.name(), targetIds));
    }

    @Transactional(readOnly = true)
    public Map<UUID, Long> commentCounts(DiscussionTargetType type, Collection<UUID> targetIds) {
        if (targetIds == null || targetIds.isEmpty()) return Map.of();
        return toCountMap(commentRepository.countComments(type.name(), targetIds));
    }

    // ── Ghi ──────────────────────────────────────────────────────────────────────────────────────

    /**
     * Tệp kèm đi lên NGOÀI transaction — khuôn chung {@link CloudinaryStorageService#uploadThenSave}
     * (không có tệp thì chỉ là một transaction như cũ).
     */
    public DiscussionCommentResponse create(DiscussionTargetType type, UUID targetId, String body, UUID parentId,
                                            List<UUID> mentionIds, MultipartFile[] files) throws IOException {
        return create(type, targetId, body, parentId, mentionIds, files, null);
    }

    /** {@code sourceDocumentIds[i]}: tài liệu thư viện mà {@code files[i]} được sao từ đó ("" / "-" = tệp từ máy). */
    public DiscussionCommentResponse create(DiscussionTargetType type, UUID targetId, String body, UUID parentId,
                                            List<UUID> mentionIds, MultipartFile[] files,
                                            List<String> sourceDocumentIds) throws IOException {
        MultipartFile[] realFiles = files == null ? new MultipartFile[0]
                : Arrays.stream(files).filter(f -> f != null && !f.isEmpty()).toArray(MultipartFile[]::new);
        return storage.uploadThenSave(realFiles, "discussions/" + targetId,
                () -> checkCreate(type, targetId, body, parentId, mentionIds, realFiles),
                (ctx, stored) -> {
                    DiscussionComment comment = commentRepository.save(DiscussionComment.builder()
                            .organizationId(ctx.target().organizationId())
                            .targetType(type)
                            .targetId(targetId)
                            .parentId(parentId)
                            .author(ctx.me())
                            .kind(DiscussionCommentKind.USER)
                            .body(ctx.text())
                            .createdAt(Instant.now())
                            .build());
                    if (ctx.parent() != null) commentRepository.adjustReplyCount(ctx.parent().getId(), 1);

                    Map<MultipartFile, AttachmentLibrarySources.Source> sources = librarySources.link(
                            files, sourceDocumentIds, ctx.me().getId(), ctx.target().organizationId());
                    for (CloudinaryStorageService.StoredFile f : stored) {
                        MultipartFile file = f.source();
                        AttachmentLibrarySources.Source src = sources.get(file);
                        attachmentRepository.save(DiscussionAttachment.builder()
                                .commentId(comment.getId())
                                .fileName(attachmentPolicy.safeFileName(file.getOriginalFilename()))
                                .fileUrl(f.url())
                                .fileSize(file.getSize())
                                .contentType(file.getContentType())
                                .storageProvider(StorageProvider.CLOUDINARY)
                                .storageKey(f.publicId())
                                .uploadedBy(ctx.me().getId())
                                .sourceDocumentId(src != null ? src.documentId() : null)
                                .sourceDocumentTitle(src != null ? src.title() : null)
                                .build());
                    }
                    for (UUID m : ctx.mentions()) {
                        mentionRepository.save(DiscussionMention.builder().commentId(comment.getId()).mentionedUserId(m).build());
                    }
                    // Viết vào cuộc trao đổi = đã đọc tới đây.
                    readStateRepository.markRead(ctx.me().getId(), type.name(), targetId, comment.getCreatedAt());

                    events.publishEvent(new DiscussionEvents.Changed(type, targetId, comment.getId(), parentId, DiscussionEvents.Action.CREATED));
                    events.publishEvent(new DiscussionEvents.CommentCreated(comment.getId(), List.copyOf(ctx.mentions())));
                    return single(ctx.me(), ctx.target(), comment);
                });
    }

    private record CreateContext(User me, DiscussionTargets.Target target, String text,
                                 DiscussionComment parent, Set<UUID> mentions) {}

    /** Kiểm quyền + nội dung của bình luận mới; gọi trong transaction (trước và sau khi tải tệp). */
    private CreateContext checkCreate(DiscussionTargetType type, UUID targetId, String body, UUID parentId,
                                      List<UUID> mentionIds, MultipartFile[] realFiles) {
        User me = currentUser();
        DiscussionTargets.Target t = targets.load(type, targetId);
        targets.assertCanComment(me.getId(), t);

        String text = normalizeBody(body);
        if (text == null && realFiles.length == 0) throw new BusinessException(ErrorCode.DISCUSSION_COMMENT_EMPTY);

        DiscussionComment parent = null;
        if (parentId != null) {
            parent = findComment(parentId);
            if (!parent.getTargetId().equals(targetId) || parent.getTargetType() != type) {
                throw new ForbiddenException(ErrorCode.DISCUSSION_COMMENT_NOT_FOUND);
            }
            if (parent.getParentId() != null) throw new BusinessException(ErrorCode.DISCUSSION_REPLY_NESTED);
            if (parent.isDeleted()) throw new BusinessException(ErrorCode.DISCUSSION_REPLY_TO_DELETED);
        }
        Set<UUID> mentions = validateMentions(me, t, mentionIds);
        attachmentPolicy.validate(realFiles, 0, CollabAttachmentPolicy.MAX_FILES_PER_COMMENT, ErrorCode.DISCUSSION_TOO_MANY_FILES);
        return new CreateContext(me, t, text, parent, mentions);
    }

    @Transactional
    public DiscussionCommentResponse update(UUID commentId, UpdateCommentRequest request) {
        User me = currentUser();
        DiscussionComment c = findComment(commentId);
        if (c.isSystem()) throw new BusinessException(ErrorCode.DISCUSSION_SYSTEM_READONLY);
        if (c.isDeleted()) throw new BusinessException(ErrorCode.DISCUSSION_COMMENT_DELETED);
        if (c.getAuthor() == null || !c.getAuthor().getId().equals(me.getId())) {
            throw new ForbiddenException(ErrorCode.DISCUSSION_EDIT_NOT_AUTHOR);
        }
        DiscussionTargets.Target t = targets.load(c.getTargetType(), c.getTargetId());
        targets.assertCanComment(me.getId(), t);

        String text = normalizeBody(request.getBody());
        boolean hasFiles = !attachmentRepository.findByCommentIdInOrderByCreatedAtAsc(List.of(commentId)).isEmpty();
        if (text == null && !hasFiles) throw new BusinessException(ErrorCode.DISCUSSION_COMMENT_EMPTY);

        Set<UUID> mentions = validateMentions(me, t, request.getMentionIds());
        Set<UUID> before = mentionRepository.findByCommentIdIn(List.of(commentId)).stream()
                .map(DiscussionMention::getMentionedUserId).collect(Collectors.toSet());
        mentionRepository.deleteByCommentId(commentId);
        mentionRepository.flush();
        for (UUID m : mentions) {
            mentionRepository.save(DiscussionMention.builder().commentId(commentId).mentionedUserId(m).build());
        }

        boolean changed = !Objects.equals(text, c.getBody());
        c.setBody(text);
        if (changed) c.setEditedAt(Instant.now());
        commentRepository.save(c);

        List<UUID> added = mentions.stream().filter(m -> !before.contains(m)).toList();
        if (!added.isEmpty()) events.publishEvent(new DiscussionEvents.MentionsAdded(commentId, added));
        events.publishEvent(new DiscussionEvents.Changed(c.getTargetType(), c.getTargetId(), commentId, c.getParentId(),
                DiscussionEvents.Action.UPDATED));
        return single(me, t, c);
    }

    @Transactional
    public void delete(UUID commentId) {
        User me = currentUser();
        DiscussionComment c = findComment(commentId);
        if (c.isSystem()) throw new BusinessException(ErrorCode.DISCUSSION_SYSTEM_READONLY);
        if (c.isDeleted()) return;
        DiscussionTargets.Target t = targets.load(c.getTargetType(), c.getTargetId());
        boolean isAuthor = c.getAuthor() != null && c.getAuthor().getId().equals(me.getId());
        boolean allowed = isAuthor ? targets.canView(me.getId(), t) : targets.canModerate(me.getId(), t);
        if (!allowed) throw new ForbiddenException(ErrorCode.DISCUSSION_DELETE_NOT_ALLOWED);

        c.setDeletedAt(Instant.now());
        c.setDeletedBy(me.getId());
        commentRepository.save(c);
        if (c.getParentId() != null) commentRepository.adjustReplyCount(c.getParentId(), -1);
        events.publishEvent(new DiscussionEvents.Changed(c.getTargetType(), c.getTargetId(), commentId, c.getParentId(),
                DiscussionEvents.Action.DELETED));
    }

    /** Bật / tắt một cảm xúc của người dùng hiện tại; trả bình luận sau khi đổi. */
    @Transactional
    public DiscussionCommentResponse toggleReaction(UUID commentId, DiscussionReactionType reaction) {
        User me = currentUser();
        DiscussionComment c = findComment(commentId);
        if (c.isDeleted()) throw new BusinessException(ErrorCode.DISCUSSION_COMMENT_DELETED);
        DiscussionTargets.Target t = targets.load(c.getTargetType(), c.getTargetId());
        targets.assertCanComment(me.getId(), t);

        DiscussionReaction.Key key = new DiscussionReaction.Key(commentId, me.getId(), reaction);
        if (reactionRepository.existsById(key)) {
            reactionRepository.deleteById(key);
        } else {
            reactionRepository.save(DiscussionReaction.builder().commentId(commentId).userId(me.getId())
                    .reaction(reaction).createdAt(Instant.now()).build());
        }
        reactionRepository.flush();
        events.publishEvent(new DiscussionEvents.Changed(c.getTargetType(), c.getTargetId(), commentId, c.getParentId(),
                DiscussionEvents.Action.REACTED));
        return single(me, t, c);
    }

    @Transactional
    public void markRead(DiscussionTargetType type, UUID targetId) {
        User me = currentUser();
        DiscussionTargets.Target t = targets.load(type, targetId);
        targets.assertCanView(me.getId(), t);
        readStateRepository.markRead(me.getId(), type.name(), targetId, Instant.now());
    }

    /**
     * Ghi một dòng hệ thống vào khung thảo luận (duyệt, từ chối, thay thế…). Gọi trong transaction của thao tác
     * gốc nên dòng hệ thống và thay đổi trạng thái cùng commit hoặc cùng huỷ.
     *
     * @param notifyUserId người duy nhất mà dòng này tính vào số chưa đọc (null = không ai)
     */
    @Transactional
    public void postSystem(DiscussionTargetType type, UUID targetId, UUID organizationId, LocalizedText text,
                           Map<String, Object> meta, UUID notifyUserId) {
        DiscussionComment c = commentRepository.save(DiscussionComment.builder()
                .organizationId(organizationId)
                .targetType(type)
                .targetId(targetId)
                .kind(DiscussionCommentKind.SYSTEM)
                .systemI18n(text.toJson())
                .systemMeta(meta)
                .notifyUserId(notifyUserId)
                .createdAt(Instant.now())
                .build());
        events.publishEvent(new DiscussionEvents.Changed(type, targetId, c.getId(), null, DiscussionEvents.Action.CREATED));
    }

    // ── Ghép phản hồi ────────────────────────────────────────────────────────────────────────────

    private DiscussionPageResponse pageOf(User me, DiscussionTargets.Target t, List<DiscussionComment> list,
                                          boolean withReplies, boolean hasMore) {
        boolean canModerate = targets.canModerate(me.getId(), t);
        boolean canComment = targets.canComment(me.getId(), t);
        DiscussionComment last = list.isEmpty() ? null : list.get(list.size() - 1);
        return DiscussionPageResponse.builder()
                .content(assemble(me, t, list, withReplies, canModerate, canComment))
                .hasMore(hasMore)
                .nextCursor(hasMore && last != null ? Cursor.of(last) : null)
                .canComment(canComment)
                .canModerate(canModerate)
                .targetTitle(t.title())
                .kpiId(t.kpiId())
                .build();
    }

    private DiscussionCommentResponse single(User me, DiscussionTargets.Target t, DiscussionComment c) {
        return assemble(me, t, List.of(c), false, targets.canModerate(me.getId(), t),
                targets.canComment(me.getId(), t)).get(0);
    }

    private List<DiscussionCommentResponse> assemble(User me, DiscussionTargets.Target t, List<DiscussionComment> list,
                                                     boolean withReplies, boolean canModerate, boolean canComment) {
        if (list.isEmpty()) return new ArrayList<>();

        Map<UUID, List<DiscussionComment>> repliesByParent = new HashMap<>();
        if (withReplies) {
            List<UUID> withChildren = list.stream().filter(c -> c.getReplyCount() > 0).map(DiscussionComment::getId).toList();
            if (!withChildren.isEmpty()) {
                commentRepository.findLatestReplies(withChildren, INLINE_REPLIES).stream()
                        .sorted(Comparator.comparing(DiscussionComment::getCreatedAt).thenComparing(DiscussionComment::getId))
                        .forEach(r -> repliesByParent.computeIfAbsent(r.getParentId(), k -> new ArrayList<>()).add(r));
            }
        }
        List<DiscussionComment> all = new ArrayList<>(list);
        repliesByParent.values().forEach(all::addAll);
        List<UUID> ids = all.stream().map(DiscussionComment::getId).toList();

        Map<UUID, List<DiscussionAttachment>> files = attachmentRepository.findByCommentIdInOrderByCreatedAtAsc(ids).stream()
                .collect(Collectors.groupingBy(DiscussionAttachment::getCommentId));
        Map<UUID, List<DiscussionReaction>> reactions = reactionRepository.findByCommentIdIn(ids).stream()
                .collect(Collectors.groupingBy(DiscussionReaction::getCommentId));
        Map<UUID, List<DiscussionMention>> mentions = mentionRepository.findByCommentIdIn(ids).stream()
                .collect(Collectors.groupingBy(DiscussionMention::getCommentId));

        Set<UUID> authorIds = all.stream().filter(c -> c.getAuthor() != null).map(c -> c.getAuthor().getId())
                .collect(Collectors.toSet());
        Set<UUID> userIds = new HashSet<>(authorIds);
        reactions.values().forEach(rs -> rs.forEach(r -> userIds.add(r.getUserId())));
        mentions.values().forEach(ms -> ms.forEach(m -> userIds.add(m.getMentionedUserId())));
        Map<UUID, User> users = userRepository.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, String[]> roles = primaryRoles(authorIds);
        AttachmentLibrarySources.Viewer library = librarySources.viewer(files.values().stream().flatMap(List::stream)
                .map(DiscussionAttachment::getSourceDocumentId).toList(), me.getId(), t.organizationId());

        Function<DiscussionComment, DiscussionCommentResponse> build = c -> {
            DiscussionCommentResponse r = mapper.toResponse(c);
            boolean mine = c.getAuthor() != null && c.getAuthor().getId().equals(me.getId());
            if (c.isSystem()) {
                LocalizedText txt = LocalizedText.fromJson(c.getSystemI18n());
                r.setSystemText(txt != null ? txt.render() : null);
            }
            if (c.isDeleted()) {
                // Chỉ còn khung "Bình luận đã bị xoá" để giữ chỗ cho các trả lời.
                r.setBody(null);
                r.setAttachments(List.of());
                r.setReactions(List.of());
                r.setMentions(List.of());
                return r;
            }
            if (c.getAuthor() != null) {
                User u = users.get(c.getAuthor().getId());
                String[] role = roles.getOrDefault(c.getAuthor().getId(), new String[2]);
                r.setAuthor(DiscussionCommentResponse.Author.builder()
                        .id(c.getAuthor().getId())
                        .fullName(u != null ? u.getFullName() : null)
                        .avatarUrl(u != null ? u.getAvatarUrl() : null)
                        .title(role[0]).unitName(role[1]).build());
            }
            r.setAttachments(files.getOrDefault(c.getId(), List.of()).stream().map(a -> {
                DiscussionCommentResponse.Attachment ar = mapper.toAttachment(a);
                Document src = library.openable(a.getSourceDocumentId());
                if (src != null) {
                    ar.setSourceDocumentId(src.getId());
                    ar.setSourceDocumentTitle(src.getTitle());
                }
                return ar;
            }).toList());
            r.setReactions(summarizeReactions(reactions.getOrDefault(c.getId(), List.of()), me.getId(), users));
            r.setMentions(mentions.getOrDefault(c.getId(), List.of()).stream()
                    .map(m -> DiscussionCommentResponse.Mention.builder().id(m.getMentionedUserId())
                            .fullName(users.containsKey(m.getMentionedUserId()) ? users.get(m.getMentionedUserId()).getFullName() : null)
                            .build())
                    .toList());
            r.setCanEdit(!c.isSystem() && mine && canComment);
            r.setCanDelete(!c.isSystem() && (mine || canModerate));
            return r;
        };

        List<DiscussionCommentResponse> out = new ArrayList<>();
        for (DiscussionComment c : list) {
            DiscussionCommentResponse r = build.apply(c);
            if (withReplies) {
                r.setReplies(repliesByParent.getOrDefault(c.getId(), List.of()).stream().map(build).toList());
            }
            out.add(r);
        }
        return out;
    }

    private static List<DiscussionCommentResponse.Reaction> summarizeReactions(List<DiscussionReaction> list, UUID me,
                                                                                Map<UUID, User> users) {
        Map<DiscussionReactionType, List<DiscussionReaction>> byType = list.stream()
                .collect(Collectors.groupingBy(DiscussionReaction::getReaction, () -> new EnumMap<>(DiscussionReactionType.class),
                        Collectors.toList()));
        return byType.entrySet().stream().map(e -> DiscussionCommentResponse.Reaction.builder()
                        .type(e.getKey())
                        .count(e.getValue().size())
                        .mine(e.getValue().stream().anyMatch(r -> r.getUserId().equals(me)))
                        .userNames(e.getValue().stream().limit(10)
                                .map(r -> users.containsKey(r.getUserId()) ? users.get(r.getUserId()).getFullName() : "")
                                .toList())
                        .build())
                .toList();
    }

    /** Chức danh + tên đơn vị theo vai trò "cao nhất" (rank nhỏ nhất) của mỗi người: [title, unitName]. */
    private Map<UUID, String[]> primaryRoles(Collection<UUID> userIds) {
        if (userIds.isEmpty()) return Map.of();
        Map<UUID, String[]> out = new HashMap<>();
        userRoleOrgUnitRepository.findByUserIdInWithUnit(userIds).stream()
                .sorted(Comparator.comparing((UserRoleOrgUnit a) -> a.getRole().getRank() == null ? 99 : a.getRole().getRank()))
                .forEach(a -> out.putIfAbsent(a.getUser().getId(),
                        new String[]{a.getRole().getName(), a.getOrgUnit() != null ? a.getOrgUnit().getName() : null}));
        return out;
    }

    // ── Tiện ích ─────────────────────────────────────────────────────────────────────────────────

    private Set<UUID> validateMentions(User me, DiscussionTargets.Target t, List<UUID> mentionIds) {
        Set<UUID> out = new LinkedHashSet<>();
        if (mentionIds == null) return out;
        for (UUID id : mentionIds) {
            if (id == null || id.equals(me.getId())) continue;
            if (!targets.canBeMentioned(id, t)) {
                String name = userRepository.findById(id).map(User::getFullName).orElse(id.toString());
                throw new ForbiddenException(ErrorCode.DISCUSSION_MENTION_NOT_ALLOWED, name);
            }
            out.add(id);
        }
        return out;
    }

    private static String normalizeBody(String body) {
        if (body == null) return null;
        String s = body.strip();
        if (s.isEmpty()) return null;
        if (s.length() > MAX_BODY) throw new BusinessException(ErrorCode.DISCUSSION_COMMENT_TOO_LONG, MAX_BODY);
        return s;
    }

    private DiscussionComment findComment(UUID id) {
        return commentRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DISCUSSION_COMMENT_NOT_FOUND));
    }

    private static int clamp(Integer size) {
        if (size == null || size <= 0) return DEFAULT_PAGE;
        return Math.min(size, MAX_PAGE);
    }

    private static Map<UUID, Long> toCountMap(List<Object[]> rows) {
        Map<UUID, Long> out = new HashMap<>();
        for (Object[] r : rows) {
            UUID id = r[0] instanceof UUID u ? u : UUID.fromString(r[0].toString());
            out.put(id, ((Number) r[1]).longValue());
        }
        return out;
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }

    /** Con trỏ mờ {@code <createdAt ISO>_<id>} của phần tử cuối trang. */
    record Cursor(Instant at, UUID id) {
        static Cursor parse(String raw) {
            if (raw == null || raw.isBlank()) {
                return new Cursor(DiscussionCommentRepository.NO_CURSOR_AT, DiscussionCommentRepository.NO_CURSOR_ID);
            }
            int sep = raw.lastIndexOf('_');
            try {
                return new Cursor(Instant.parse(raw.substring(0, sep)), UUID.fromString(raw.substring(sep + 1)));
            } catch (RuntimeException e) {
                throw new BusinessException(ErrorCode.BAD_REQUEST_PARAM, "cursor");
            }
        }

        static String of(DiscussionComment c) {
            return c.getCreatedAt() + "_" + c.getId();
        }
    }
}
