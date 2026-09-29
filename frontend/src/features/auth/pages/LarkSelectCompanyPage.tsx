import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Building2, ChevronRight, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { publicOrgApi, type PublicOrganization } from '../api/publicOrgApi'
import { authApi } from '../api/authApi'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { LARK_STATE_KEY, LARK_PURPOSE_KEY } from '../hooks/useLarkLogin'
import { useTranslation } from 'react-i18next'

const PAGE_SIZE = 10
const LAST_COMPANY_KEY = 'lark_last_company'

interface LastCompany {
  id: string
  name: string
  avatarUrl?: string | null
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/**
 * Logo công ty lấy từ Lark, rơi về chữ cái đầu khi không có URL hoặc ảnh tải lỗi.
 * URL nằm trên CDN của Lark nên có thể đổi hoặc hết hạn — thiếu onError là danh sách đầy ảnh vỡ.
 */
function OrgAvatar({
  name,
  avatarUrl,
  highlighted,
}: {
  name: string
  avatarUrl?: string | null
  highlighted?: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-control object-cover"
      />
    )
  }

  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-sm font-semibold',
        highlighted
          ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
          : 'bg-[var(--color-muted)] text-[var(--color-foreground)]'
      )}
    >
      {initials(name)}
    </div>
  )
}

export default function LarkSelectCompanyPage() {
  const { t } = useTranslation('auth')
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebounce(keyword, 400)
  const [selectingId, setSelectingId] = useState<string | null>(null)

  const lastCompany = useMemo<LastCompany | null>(() => {
    try {
      const raw = localStorage.getItem(LAST_COMPANY_KEY)
      return raw ? (JSON.parse(raw) as LastCompany) : null
    } catch {
      return null
    }
  }, [])

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['public-organizations', debouncedKeyword],
      queryFn: ({ pageParam }) => publicOrgApi.search(debouncedKeyword, pageParam, PAGE_SIZE),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.page + 1),
      retry: false,
    })

  const organizations = useMemo(
    () => data?.pages.flatMap((p) => p.content) ?? [],
    [data]
  )

  // Cuộn tới đáy thì tải thêm
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '120px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const authorizeMutation = useMutation({
    mutationFn: (org: LastCompany) =>
      authApi.getLarkAuthorizeUrl(org.id).then((res) => ({ res, org })),
    onSuccess: ({ res, org }) => {
      sessionStorage.setItem(LARK_STATE_KEY, res.state)
      sessionStorage.setItem(LARK_PURPOSE_KEY, 'login')
      localStorage.setItem(
        LAST_COMPANY_KEY,
        JSON.stringify({ id: org.id, name: org.name, avatarUrl: org.avatarUrl ?? null })
      )
      window.location.href = res.authorizeUrl
    },
    onError: (err: any) => {
      setSelectingId(null)
      toast.error(getApiErrorMessage(err, t('LarkSelectCompanyPage.couldNotStartLarkSignIn')))
    },
  })

  const handleSelect = (org: LastCompany) => {
    setSelectingId(org.id)
    authorizeMutation.mutate(org)
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] transition-colors"
      >
        <ArrowLeft size={16} />
        {t('LarkSelectCompanyPage.back')}
      </Link>

      <h1 className="text-page-title mt-5 text-[var(--color-foreground)]">{t('LarkSelectCompanyPage.chooseYourCompany')}</h1>
      <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
        {t('LarkSelectCompanyPage.youWillSignInWithThis')}
      </p>

      {lastCompany && !keyword && (
        <button className="mt-5 flex w-full items-center gap-3 rounded-card border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-3 text-left transition-colors hover:bg-[var(--color-muted)]" type="button" onClick={() => handleSelect(lastCompany)} disabled={authorizeMutation.isPending}>
          <OrgAvatar aria-hidden="true" name={lastCompany.name} avatarUrl={lastCompany.avatarUrl} highlighted />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--color-foreground)]">
              {t('LarkSelectCompanyPage.continueWith')} {lastCompany.name}
            </p>
            <p className="text-xs text-[var(--color-muted-foreground)]">{t('LarkSelectCompanyPage.lastSignedIn')}</p>
          </div>
          {selectingId === lastCompany.id ? (
            <Loader2 aria-hidden="true" className="animate-spin text-[var(--color-primary)]" />
          ) : (
            <ChevronRight aria-hidden="true" className="text-[var(--color-primary)]" />
          )}
        </button>
      )}

      <div className="relative mt-5">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]"
        />
        <input
          type="text"
          autoFocus
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t('LarkSelectCompanyPage.searchByCompanyName')}
          className="h-10 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] pl-10 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        />
      </div>

      <div className="mt-4 max-h-[46vh] space-y-2 overflow-y-auto custom-scrollbar pr-1">
        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
          </div>
        )}

        {isError && (
          <p className="py-10 text-center text-sm text-[var(--color-error)]">
            {t('LarkSelectCompanyPage.couldNotLoadTheCompanyList')}
          </p>
        )}

        {!isLoading && !isError && organizations.length === 0 && (
          <div className="py-10 text-center">
            <Building2 size={32} className="mx-auto text-[var(--color-muted-foreground)]/40" />
            <p className="mt-3 text-sm font-semibold text-[var(--color-foreground)]">
              {keyword ? t('LarkSelectCompanyPage.noMatchingCompanyFound') : t('LarkSelectCompanyPage.noCompanyHasEnabledLarkSign')}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {keyword
                ? t('LarkSelectCompanyPage.tryAnotherKeywordOrContactYour')
                : t('LarkSelectCompanyPage.anAdministratorMustConnectLarkIn')}
            </p>
          </div>
        )}

        {organizations.map((org: PublicOrganization) => (
          <button className="flex w-full items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-left transition-colors hover:bg-[var(--color-muted)]" key={org.id} type="button" onClick={() => handleSelect(org)} disabled={authorizeMutation.isPending}>
            <OrgAvatar aria-hidden="true" name={org.name} avatarUrl={org.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{org.name}</p>
            </div>
            {selectingId === org.id ? (
              <Loader2 aria-hidden="true" className="animate-spin text-[var(--color-primary)]" />
            ) : (
              <ChevronRight aria-hidden="true" className="text-[var(--color-muted-foreground)]" />
            )}
          </button>
        ))}

        <div ref={sentinelRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="flex justify-center py-3">
            <Loader2 size={18} className="animate-spin text-[var(--color-muted-foreground)]" />
          </div>
        )}
      </div>
    </div>
  )
}
