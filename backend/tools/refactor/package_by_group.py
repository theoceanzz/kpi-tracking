"""Gom file backend vào gói con theo nghiệp vụ trong từng tầng (17/10/2026).

Dời các lớp nằm ở GỐC controller/entity/repository/enums/service (main + test)
sang <tầng>/<nhóm> theo bảng RULES, rồi sửa package, import, FQN viết thẳng,
bung import wildcard và thêm import cho tham chiếu cùng gói cũ.

Nhánh còn code theo gói cũ: chạy script trên nhánh đó TRƯỚC khi merge nhánh đã dời
(script chỉ thấy lớp còn ở gốc tầng; lớp đã dời thì bỏ qua), commit, rồi merge — git
ghép hai bên cùng đổi tên về một đích.
    python -I backend/tools/refactor/package_by_group.py [--dry-run]
--dry-run chỉ in bảng ánh xạ (CSV) ra stdout.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SRC = [ROOT / 'backend/src/main/java', ROOT / 'backend/src/test/java']
BASE = 'com.kpitracking'
LAYERS = ['controller', 'entity', 'repository', 'enums', 'service']

# Thứ tự quan trọng: khớp quy tắc đầu tiên. Không khớp thì ở lại gốc tầng.
RULES = [
    (r'Bsc', 'bsc'),
    (r'\w*Analytics|Stats|Insight|OrgUnitStatistic', 'analytics'),
    (r'KpiTask|Task', 'task'),
    (r'KpiSubmission|SubmissionAttachment|SubmissionScoreLedger|SubmissionStatus|EvidenceAttachment|EvidenceTarget|AttachmentPolicy', 'submission'),
    (r'EvaluationReminder|DeadlineReminder|Reminder|Followup|Notification|OrgNotificationConfig', 'notification'),
    (r'CycleLock', 'kpi'),
    (r'KpiCycleEvaluation|CycleUnitEval|CycleUserEvaluation|CycleEvaluation|Evaluation|UnitClassification|CalibrationTargets', 'evaluation'),
    (r'Kpi|QualitativeLevel|AdjustmentStatus|PeriodLockAction|PeriodProgress'
     r'|Approval(EventAction|FlowStatus|Outcome|StepKind|StepStatus|SubjectType)\b', 'kpi'),
    (r'Okr|Objective|KeyResult', 'okr'),
    (r'Conduct', 'conduct'),
    (r'Reward|Urbox|GiftItem|Redemption|Certificate', 'reward'),
    (r'CashWallet|CashTransaction|CashSource|Topup|Sepay', 'wallet'),
    (r'Discussion', 'discussion'),
    (r'Document|PublicDocument', 'document'),
    (r'Email', 'email'),
    (r'Report|Datasource|Ds[A-Z]|ColumnDataType', 'report'),
    (r'UserDashboardLayout|DashboardLayout|DashboardScope|SidebarSetting', 'dashboard'),
    (r'F360|Feedback360', 'feedback360'),
    (r'ApprovalForm|ApprovalRequest|FormAdminPermission|FormSubmitterScope', 'approvalform'),
    (r'ApprovalProcess|ApprovalController|ApprovalObjectType', 'approvalprocess'),
    (r'Organization|OrgUnit|OrgHierarchyLevel|OrgCodeRule|CodeType|Province|District|PublicOrganization', 'organization'),
    (r'User', 'user'),
    (r'Auth|RefreshToken|Lark|SecurityAuditLog', 'auth'),
    (r'Role|Permission|Policy|Scope', 'access'),
    (r'Ai|Conversation|Chat|Rag|PlatformRag|SseTurnListener', 'ai'),
    (r'PlatformAdmin|LandingLead|PublicLanding', 'platform'),
]
TEST_SUFFIX = re.compile(r'(ITSupport|Tests|Test|IT)$')


def group_of(name):
    for pattern, group in RULES:
        if re.match(pattern, name):
            return group
    return None


def scan():
    """(file, old_pkg, simple_name) của mọi lớp ở gốc các tầng."""
    out = []
    for src in SRC:
        for layer in LAYERS:
            d = src / BASE.replace('.', '/') / layer
            if d.is_dir():
                for f in sorted(d.glob('*.java')):
                    out.append((f, f'{BASE}.{layer}', f.stem))
    return out


def main():
    dry = '--dry-run' in sys.argv
    roots = scan()
    # Lớp ở gốc mỗi tầng TRƯỚC khi dời (main + test): dùng cho wildcard và tham chiếu ngầm.
    root_classes = {}
    moves = {}  # old FQN -> new FQN
    file_moves = []
    for f, pkg, name in roots:
        root_classes.setdefault(pkg, set()).add(name)
        group = group_of(TEST_SUFFIX.sub('', name) if 'test' in f.parts else name)
        if group:
            new_pkg = f'{pkg}.{group}'
            moves[f'{pkg}.{name}'] = f'{new_pkg}.{name}'
            file_moves.append((f, pkg, new_pkg))
    if dry:
        for old, new in sorted(moves.items()):
            print(f'{old},{new}')
        unmatched = sorted(f'{p}.{n}' for f, p, n in roots if f'{p}.{n}' not in moves)
        print(f'# moved {len(moves)}, stay at layer root: {len(unmatched)}', file=sys.stderr)
        for u in unmatched:
            print(f'#   stay {u}', file=sys.stderr)
        return

    def new_fqn(pkg, name):
        return moves.get(f'{pkg}.{name}', f'{pkg}.{name}')

    # Gói cũ/mới của từng file (trước khi git mv).
    file_pkg = {}
    for f, pkg, new_pkg in file_moves:
        file_pkg[f] = (pkg, new_pkg)

    fqn_re = re.compile(r'\b(' + re.escape(BASE) + r'\.(?:' + '|'.join(LAYERS) + r'))\.([A-Z]\w*)')
    wildcard_re = re.compile(r'^import (' + re.escape(BASE) + r'\.(?:' + '|'.join(LAYERS) + r'))\.\*;\s*$', re.M)
    pkg_re = re.compile(r'^package ([\w.]+);', re.M)
    import_re = re.compile(r'^import (?:static )?([\w.]+);', re.M)
    ident_re = re.compile(r'\b[A-Z]\w*\b')

    for src in SRC:
        for f in src.rglob('*.java'):
            text = f.read_text(encoding='utf-8')
            orig = text
            m = pkg_re.search(text)
            old_pkg = m.group(1) if m else ''
            new_pkg = file_pkg.get(f, (old_pkg, old_pkg))[1]
            if new_pkg != old_pkg:
                text = text[:m.start(1)] + new_pkg + text[m.end(1):]

            text = fqn_re.sub(lambda mm: new_fqn(mm.group(1), mm.group(2)), text)

            needed = set()
            body_idents = None

            def idents():
                nonlocal body_idents
                if body_idents is None:
                    body = import_re.sub('', pkg_re.sub('', text))
                    body_idents = set(ident_re.findall(body))
                return body_idents

            for wm in list(wildcard_re.finditer(text)):
                pkg = wm.group(1)
                for name in root_classes.get(pkg, ()):
                    if name in idents():
                        needed.add(new_fqn(pkg, name))
            text = wildcard_re.sub('', text)

            # Tham chiếu ngầm: file từng ở gốc một tầng, lớp cùng gói cũ nay khác gói.
            if old_pkg in root_classes:
                for name in root_classes[old_pkg]:
                    target = new_fqn(old_pkg, name)
                    if target.rsplit('.', 1)[0] != new_pkg and name in idents() and name != f.stem:
                        needed.add(target)

            if needed:
                imported = {i.rsplit('.', 1)[1]: i for i in import_re.findall(text)}
                declared = set(re.findall(r'\b(?:class|interface|enum|record)\s+([A-Z]\w*)', text))
                add = sorted(n for n in needed
                             if n.rsplit('.', 1)[0] != new_pkg
                             and n.rsplit('.', 1)[1] not in declared
                             and imported.get(n.rsplit('.', 1)[1], n) == n
                             and n not in imported.values())
                if add:
                    lines = ''.join(f'import {n};\n' for n in add)
                    last = list(re.finditer(r'^import .*;\s*$\n?', text, re.M))
                    pos = last[-1].end() if last else pkg_re.search(text).end() + 1
                    if not last:
                        lines = '\n' + lines
                    text = text[:pos] + lines + text[pos:]

            if text != orig:
                f.write_text(text, encoding='utf-8', newline='')

    for f, pkg, new_pkg in file_moves:
        dest = f.parent / new_pkg.rsplit('.', 1)[1] / f.name
        if dest.exists():
            sys.exit(f'already exists: {dest}')
        dest.parent.mkdir(exist_ok=True)
        subprocess.run(['git', 'mv', str(f), str(dest)], check=True, cwd=ROOT)
    print(f'moved {len(file_moves)} files')


if __name__ == '__main__':
    main()
