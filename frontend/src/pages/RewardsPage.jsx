import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Coins, Crown, Flame, Gem, Gift, RefreshCw, ShoppingBag, Sparkles, Star, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Badge, Card, ProgressRing, SectionTitle, StatCard } from '../components/ui'
import { socialAPI, streaksAPI, walletAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'

const RANK_STYLES = {
  1: { ring: 'from-gold-400 to-amber-500', label: '🥇' },
  2: { ring: 'from-neutral-300 to-neutral-400', label: '🥈' },
  3: { ring: 'from-amber-600 to-amber-700', label: '🥉' },
}

function LoadState({ loading, error, retry, empty, children }) {
  if (loading) return <p role="status" className="py-5 text-sm text-neutral-500">Loading…</p>
  if (error) return <div className="py-5"><p role="alert" className="text-sm text-neutral-600 dark:text-neutral-300">This information could not be loaded.</p><button type="button" onClick={retry} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary-600"><RefreshCw className="h-4 w-4" /> Retry</button></div>
  if (empty) return <p className="py-5 text-sm text-neutral-500 dark:text-neutral-400">Nothing here yet.</p>
  return children
}

export default function RewardsPage() {
  const user = useAuthStore((state) => state.user)
  const userId = user?.id
  const [pendingSlug, setPendingSlug] = useState(null)
  const [equippingSlug, setEquippingSlug] = useState(null)
  const walletQuery = useQuery({ queryKey: ['wallet', userId], queryFn: walletAPI.get, enabled: Boolean(userId), retry: false })
  const shopQuery = useQuery({ queryKey: ['wallet-shop', userId], queryFn: () => walletAPI.shop(), enabled: Boolean(userId), retry: false })
  const inventoryQuery = useQuery({ queryKey: ['wallet-inventory', userId], queryFn: walletAPI.inventory, enabled: Boolean(userId), retry: false })
  const streakQuery = useQuery({ queryKey: ['practice-streak', userId], queryFn: streaksAPI.mine, enabled: Boolean(userId), retry: false })
  const heatmapQuery = useQuery({ queryKey: ['practice-heatmap', userId], queryFn: streaksAPI.heatmap, enabled: Boolean(userId), retry: false })
  const leaderboardQuery = useQuery({ queryKey: ['private-leaderboard', userId], queryFn: () => socialAPI.globalLeaderboard(10), enabled: Boolean(userId), retry: false })

  const wallet = walletQuery.data?.data
  const shop = Array.isArray(shopQuery.data?.data?.items) ? shopQuery.data.data.items : []
  const inventory = Array.isArray(inventoryQuery.data?.data?.items) ? inventoryQuery.data.data.items : []
  const streak = streakQuery.data?.data
  const week = Array.isArray(heatmapQuery.data?.data?.heatmap) ? heatmapQuery.data.data.heatmap.slice(-7) : []
  const board = Array.isArray(leaderboardQuery.data?.data?.leaderboard) ? leaderboardQuery.data.data.leaderboard : []
  const balance = wallet && !walletQuery.isError ? wallet.coins : null

  const buy = async (item) => {
    if (pendingSlug || item.owned || balance === null) return
    setPendingSlug(item.slug)
    try {
      await walletAPI.buy(item.slug)
      await Promise.all([walletQuery.refetch(), shopQuery.refetch(), inventoryQuery.refetch()])
      toast.success(`${item.name} added to your collection`)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not purchase this item')
    } finally {
      setPendingSlug(null)
    }
  }
  const equip = async (item) => {
    setEquippingSlug(item.item_slug)
    try {
      await walletAPI.equip(item.item_slug)
      await inventoryQuery.refetch()
      toast.success(`${item.name} equipped`)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not equip this item')
    } finally {
      setEquippingSlug(null)
    }
  }

  return <DashboardLayout title="Rewards" subtitle={`Your earned rewards and collection${user?.child_name ? `, ${user.child_name}` : ''}`} icon={Gift}>
    <Card className="relative mb-8 overflow-hidden p-0">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-secondary-600 to-secondary-700" />
      <div className="relative z-10 p-8 text-white">
        <h2 className="mb-6 flex items-center gap-2 text-lg font-bold"><ShoppingBag className="h-5 w-5" /> My Wallet</h2>
        <LoadState loading={walletQuery.isLoading} error={walletQuery.isError} retry={walletQuery.refetch}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">{[
            { icon: Coins, label: 'Coins', value: wallet?.coins },
            { icon: Star, label: 'Stars', value: wallet?.stars },
            { icon: Gem, label: 'Gems', value: wallet?.gems },
          ].map((item) => <div key={item.label} className="flex items-center gap-4 rounded-2xl bg-white/15 p-5"><item.icon className="h-8 w-8" /><div><strong className="text-3xl tabular-nums">{Number(item.value ?? 0).toLocaleString()}</strong><p className="text-xs uppercase tracking-wide text-white/80">{item.label}</p></div></div>)}</div>
        </LoadState>
      </div>
    </Card>

    <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
      <Card className="flex flex-col items-center justify-center p-6 text-center">
        <SectionTitle title="Level Progress" icon={Crown} />
        <LoadState loading={walletQuery.isLoading} error={walletQuery.isError} retry={walletQuery.refetch}>
          <ProgressRing value={Number(wallet?.level_progress ?? 0)} size={160} stroke={14} color="#F59E0B" label={`Lv ${wallet?.level ?? 1}`} sublabel={wallet?.next_level_xp == null ? 'Maximum level' : `${wallet?.xp ?? 0} XP`} />
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">{wallet?.next_level_xp == null ? 'Maximum level reached' : `${Math.max(0, wallet.next_level_xp - (wallet.xp ?? 0))} XP to level ${(wallet.level ?? 1) + 1}`}</p>
        </LoadState>
      </Card>
      <Card className="p-6 lg:col-span-2">
        <SectionTitle title="Practice Streak" subtitle="Based on recorded practice days" icon={Flame} />
        <LoadState loading={streakQuery.isLoading || heatmapQuery.isLoading} error={streakQuery.isError || heatmapQuery.isError} retry={() => { streakQuery.refetch(); heatmapQuery.refetch() }}>
          <div className="grid grid-cols-7 gap-2 sm:gap-3">{week.map((day) => <div key={day.date} className={`flex flex-col items-center gap-2 rounded-2xl border py-4 ${day.practiced ? 'border-transparent bg-coral-500 text-white' : 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800'}`} title={`${day.date}: ${day.count} practice sessions`}><span className="text-xs font-bold">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span><Flame className="h-6 w-6" /><span className="sr-only">{day.practiced ? 'Practised' : 'No practice'}</span></div>)}</div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"><StatCard icon={Flame} title="Current Streak" value={`${streak?.current_streak ?? 0} days`} color="coral" /><StatCard icon={Trophy} title="Longest Streak" value={`${streak?.longest_streak ?? 0} days`} color="gold" /></div>
        </LoadState>
      </Card>
    </div>

    <Card className="mb-8 p-6">
      <SectionTitle title="Rewards Shop" subtitle="Items available for your real wallet balance" icon={ShoppingBag} action={wallet && <Badge color="gold"><Coins className="h-3.5 w-3.5" /> {Number(wallet.coins ?? 0).toLocaleString()} coins</Badge>} />
      <LoadState loading={shopQuery.isLoading} error={shopQuery.isError} retry={shopQuery.refetch} empty={shop.length === 0}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{shop.map((item) => {
          const coinCost = Number(item.price_coins || 0)
          const gemCost = Number(item.price_gems || 0)
          const affordable = wallet && Number(wallet.coins || 0) >= coinCost && Number(wallet.gems || 0) >= gemCost
          return <div key={item.slug} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center dark:border-neutral-700 dark:bg-neutral-800/60">
            <div className="mb-3 text-4xl" aria-hidden="true">{item.icon || '🎁'}</div><p className="text-sm font-bold text-neutral-900 dark:text-white">{item.name}</p><p className="text-xs capitalize text-neutral-500">{item.type}</p>
            <p className="my-3 text-sm font-semibold text-gold-600">{coinCost} coins{gemCost ? ` · ${gemCost} gems` : ''}</p>
            <button type="button" onClick={() => buy(item)} disabled={item.owned || !affordable || Boolean(pendingSlug)} className="min-h-10 w-full rounded-xl bg-primary-600 px-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-300">{item.owned ? 'Owned' : pendingSlug === item.slug ? 'Buying…' : affordable ? 'Buy' : 'Not enough balance'}</button>
          </div>
        })}</div>
      </LoadState>
    </Card>

    <Card className="mb-8 p-6">
      <SectionTitle title="My Collection" subtitle="Items purchased on this account" icon={Gift} />
      <LoadState loading={inventoryQuery.isLoading} error={inventoryQuery.isError} retry={inventoryQuery.refetch} empty={inventory.length === 0}>
        <div className="grid gap-3 sm:grid-cols-2">{inventory.map((item) => <div key={item.item_slug} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"><div><p className="font-semibold text-neutral-900 dark:text-white">{item.name}</p><p className="text-xs capitalize text-neutral-500">{item.type}</p></div><button type="button" disabled={item.equipped || Boolean(equippingSlug)} onClick={() => equip(item)} className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-accent-100 disabled:text-accent-700">{item.equipped ? <><Check className="mr-1 inline h-3 w-3" /> Equipped</> : equippingSlug === item.item_slug ? 'Equipping…' : 'Equip'}</button></div>)}</div>
      </LoadState>
    </Card>

    <Card className="p-6"><SectionTitle title="Leaderboard" subtitle="Top learners by stars earned" icon={Trophy} />
      <LoadState loading={leaderboardQuery.isLoading} error={leaderboardQuery.isError} retry={leaderboardQuery.refetch} empty={board.length === 0}>
        <div className="space-y-2">{board.map((person) => {
          const medal = RANK_STYLES[person.rank]
          return <div key={person.rank} className={`flex items-center gap-4 rounded-2xl border px-4 py-3 ${person.is_me ? 'border-primary-200 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/30' : 'border-neutral-100 bg-white dark:border-neutral-800 dark:bg-neutral-900'}`}>
            <div className="w-9 text-center font-bold text-neutral-500">{medal ? medal.label : `#${person.rank}`}</div>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${medal?.ring || 'from-primary-500 to-secondary-500'}`}>{(person.name || '?').charAt(0).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-neutral-900 dark:text-white">{person.name} {person.is_me && <Badge color="primary">You</Badge>}</p><p className="text-xs text-neutral-500">Rank #{person.rank}</p></div>
            <span className="flex items-center gap-1 text-sm font-bold text-gold-600"><Sparkles className="h-4 w-4" /> {Number(person.stars || 0).toLocaleString()}</span>
          </div>
        })}</div>
      </LoadState>
    </Card>
  </DashboardLayout>
}
