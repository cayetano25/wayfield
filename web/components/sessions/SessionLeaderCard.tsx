import { MapPin, Phone } from 'lucide-react';
import { LeaderAvatar } from '@/components/ui/LeaderAvatar';
import type { SessionLeader } from '@/lib/types/leader';
import { leaderFullName, leaderLocation } from '@/lib/types/leader';

interface SessionLeaderCardProps {
  leaders: SessionLeader[];
}

export function SessionLeaderCard({ leaders }: SessionLeaderCardProps) {
  if (leaders.length === 0) return null;

  const heading = leaders.length === 1 ? 'Leader' : 'Leaders';

  return (
    <div
      className="bg-white border border-[#E5E7EB] p-5 space-y-0"
      style={{ borderRadius: '12px' }}
    >
      <h2 className="font-heading text-base font-semibold text-[#2E2E2E] mb-4">
        {heading}
      </h2>

      {leaders.map((leader, index) => {
        const fullName = leaderFullName(leader);
        const location = leaderLocation(leader);
        const hasBio = leader.bio && leader.bio.trim().length > 0;
        const showPhone = leader.phone_visible && leader.phone_number != null;

        return (
          <div key={leader.id}>
            {index > 0 && (
              <hr
                className="my-4"
                style={{ border: 'none', borderTop: '1px solid #F3F4F6' }}
              />
            )}

            {/* Avatar + info row */}
            <div className="flex items-start gap-4">
              <LeaderAvatar leader={leader} size="md" />

              <div className="flex flex-col gap-1 flex-1">
                {/* Name + role badge */}
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[15px] font-semibold text-[#2E2E2E]">
                    {fullName}
                  </span>
                  {leader.role_label != null && (
                    <span
                      className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5"
                      style={{ borderRadius: '9999px' }}
                    >
                      {leader.role_label}
                    </span>
                  )}
                </div>

                {/* Location */}
                {location != null && (
                  <div className="flex items-center gap-1 text-[13px] text-[#6B7280]">
                    <MapPin className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                    <span>{location}</span>
                  </div>
                )}

                {/* Phone */}
                {showPhone && (
                  <div className="flex items-center gap-1 text-[13px] text-[#6B7280]">
                    <Phone className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                    <a
                      href={`tel:${leader.phone_number}`}
                      className="hover:text-teal-600 transition-colors"
                    >
                      {leader.phone_number}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {hasBio && (
              <p
                className="text-[13px] text-[#4B5563]"
                style={{ marginTop: '12px', lineHeight: '1.6' }}
              >
                {leader.bio}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
