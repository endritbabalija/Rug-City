export interface Player {
  id: number
  name: string
  username?: string
  photoUrl?: string
  createdAt: number
}

export function newPlayer(profile: { id: number; name: string; username?: string; photoUrl?: string }, now: number): Player {
  return { ...profile, createdAt: now }
}
