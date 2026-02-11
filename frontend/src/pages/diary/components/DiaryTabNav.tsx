import type { DailyDiary, DiaryTab } from '../types'

interface DiaryTabNavProps {
  activeTab: DiaryTab
  onTabChange: (tab: DiaryTab) => void
  diary: DailyDiary | null
}

const TABS: DiaryTab[] = ['weather', 'personnel', 'plant', 'activities', 'delays']

const TAB_COUNT_KEYS: Partial<Record<DiaryTab, keyof Pick<DailyDiary, 'personnel' | 'plant' | 'activities' | 'delays'>>> = {
  personnel: 'personnel',
  plant: 'plant',
  activities: 'activities',
  delays: 'delays',
}

export function DiaryTabNav({ activeTab, onTabChange, diary }: DiaryTabNavProps) {
  return (
    <div className="border-b">
      <nav className="flex gap-4">
        {TABS.map((tab) => {
          const countKey = TAB_COUNT_KEYS[tab]
          const count = diary && countKey ? diary[countKey].length : 0
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {count > 0 && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{count}</span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
