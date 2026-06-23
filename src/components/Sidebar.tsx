import { useState } from 'react'
import { Settings, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  openSection: string
  onOpenSectionChange: (section: string) => void
  loanSetupSlot?: React.ReactNode
  addEventSlot?: React.ReactNode
}

export default function Sidebar({
  openSection,
  onOpenSectionChange,
  loanSetupSlot,
  addEventSlot,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  function expandTo(section: string) {
    setIsCollapsed(false)
    onOpenSectionChange(section)
  }

  return (
    <aside
      className={[
        'relative flex shrink-0 flex-col border-r border-border-subtle bg-bg-surface',
        'overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none',
        isCollapsed ? 'w-16' : 'w-[280px]',
      ].join(' ')}
    >
      {/* Icon rail — always mounted, hidden when expanded to preserve form state */}
      <nav
        className={cn(
          'flex flex-col items-center gap-2 pt-3',
          isCollapsed ? 'flex-1' : 'hidden',
        )}
        aria-label="Sidebar navigation"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => expandTo('loan-setup')}
          aria-label="Open Loan Setup"
          title="Loan Setup"
        >
          <Settings className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => expandTo('add-event')}
          aria-label="Open Add Event"
          title="Add Event"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </nav>

      {/* Accordion — always mounted, hidden when collapsed to preserve form state */}
      <div className={cn('flex-1 overflow-y-auto', isCollapsed && 'hidden')}>
        <Accordion
          type="single"
          collapsible
          value={openSection}
          onValueChange={onOpenSectionChange}
        >
          <AccordionItem value="loan-setup" className="px-4">
            <AccordionTrigger className="text-sm font-medium text-text-primary">
              Loan Setup
            </AccordionTrigger>
            <AccordionContent>
              {loanSetupSlot ?? (
                <p className="pb-2 text-sm text-text-muted">Coming soon</p>
              )}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="add-event" className="px-4">
            <AccordionTrigger className="text-sm font-medium text-text-primary">
              Add Event
            </AccordionTrigger>
            <AccordionContent>
              {addEventSlot ?? (
                <p className="pb-2 text-sm text-text-muted">Coming soon</p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Collapse / expand toggle at the bottom */}
      <div className="flex justify-end border-t border-border-subtle p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed((c) => !c)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  )
}
