'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { platformUsers, type UserListItem, type UserDetail } from '@/lib/platform-api';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Table, TableHead, Th, TableBody, Td } from '@/components/ui/Table';
import UserSlideOver from '@/components/UserSlideOver';

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <tr key={i}>
          <td colSpan={6} className="px-4 py-1">
            <div className="animate-pulse bg-gray-100 h-12 rounded my-1" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Verified badge ───────────────────────────────────────────────────────────

function VerifiedBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
      Unverified
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { adminUser } = useAdminUser();
  const router = useRouter();

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearchValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [slideOverOpen, setSlideOverOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (adminUser && !can.viewUsers(adminUser.role)) {
      router.replace('/');
    }
  }, [adminUser, router]);

  async function load(q: string, p: number) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformUsers.list({ search: q || undefined, page: p });
      setUsers(data.data);
      setTotal(data.total);
      setLastPage(data.last_page);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(search, page); }, [search, page]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchValue(value);
      setPage(1);
    }, 300);
  }

  async function openUser(id: number) {
    try {
      const { data } = await platformUsers.get(id);
      setSelectedUser(data);
      setSlideOverOpen(true);
    } catch {
      // silently ignore — user can retry from list
    }
  }

  function closeSlideOver() {
    setSlideOverOpen(false);
    setSelectedUser(null);
  }

  const from = total === 0 ? 0 : (page - 1) * 25 + 1;
  const to = Math.min(page * 25, total);

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="Users"
        subtitle={total > 0 ? `${total.toLocaleString()} total` : undefined}
      />

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative w-80">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name or email"
            className="w-full min-h-[44px] pl-9 pr-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent"
          />
        </div>
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} onRetry={() => load(search, page)} />}

      {/* Table */}
      {!error && (
        <Table>
          <TableHead>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Orgs</Th>
            <Th>Last Login</Th>
            <Th>Verified</Th>
            <Th><span className="sr-only">Actions</span></Th>
          </TableHead>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon={Users}
                    heading="No users found"
                    subtitle="Try adjusting your search."
                  />
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <Td>
                    <span className="text-sm font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm text-gray-600">{user.email}</span>
                  </Td>
                  <Td>
                    <span
                      className="text-sm text-gray-600"
                      style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                    >
                      {user.organization_count}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm text-gray-400">
                      {user.last_login_at
                        ? formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true })
                        : '—'}
                    </span>
                  </Td>
                  <Td>
                    <VerifiedBadge verified={!!user.email_verified_at} />
                  </Td>
                  <Td>
                    <button
                      onClick={() => openUser(user.id)}
                      className="min-h-[44px] flex items-center text-sm font-medium text-[#0FA3B1] hover:text-[#0d8f9c] transition-colors"
                    >
                      View →
                    </button>
                  </Td>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {!loading && !error && total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            Showing {from}–{to} of {total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= lastPage}
              className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Slide-over */}
      <UserSlideOver
        user={selectedUser}
        open={slideOverOpen}
        onClose={closeSlideOver}
      />
    </div>
  );
}
