import { useState } from 'react'

interface AvatarBadgeProps {
  username: string
  name: string
  avatarUrl: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES: Record<NonNullable<AvatarBadgeProps['size']>, string> = {
  sm: 'h-9 w-9 text-[10px]',
  md: 'h-14 w-14 text-sm',
  lg: 'h-20 w-20 text-base',
}

export function AvatarBadge({ username, name, avatarUrl, size = 'md' }: AvatarBadgeProps) {
  const [imgError, setImgError] = useState(false)
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  if (imgError) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-sm border-2 border-amber-400 bg-[#174636] font-pixel-title text-amber-200 ${SIZE_CLASSES[size]}`}
      >
        {initials || username.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={avatarUrl}
      alt={`Avatar de ${name}`}
      onError={() => setImgError(true)}
      className={`shrink-0 rounded-sm border-2 border-amber-400 bg-[#0d1833] object-cover ${SIZE_CLASSES[size]}`}
    />
  )
}
