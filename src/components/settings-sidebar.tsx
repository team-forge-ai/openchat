import { Bot, MessageSquare, Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAppContext } from '@/contexts/app-context'
import { cn } from '@/lib/utils'

type SettingsSection = {
  id: string
  title: string

  icon: React.ComponentType<any>
}

const settingsSections: SettingsSection[] = [
  { id: 'system-prompt', title: 'System Prompt', icon: SettingsIcon },
  { id: 'model-selection', title: 'Model', icon: Bot },
  { id: 'mcp-servers', title: 'MCP Servers', icon: SettingsIcon },
]

export function SettingsSidebar() {
  const { setView } = useAppContext()
  const { open } = useSidebar()
  const [activeSection, setActiveSection] = useState<string>('system-prompt')

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const sections = settingsSections.map((s) => s.id)

    sections.forEach((sectionId) => {
      const element = document.getElementById(sectionId)
      if (!element) {
        return
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(sectionId)
            }
          })
        },
        { rootMargin: '-100px 0px -80% 0px', threshold: 0 },
      )

      observer.observe(element)
      observers.push(observer)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [])

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const navigateToApp = () => setView('conversations')

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="flex flex-col gap-5 pt-15">
        <h2 className="text-lg font-semibold px-2">Settings</h2>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {settingsSections.map((section) => (
            <SidebarMenuItem key={section.id}>
              <SidebarMenuButton
                isActive={activeSection === section.id}
                onClick={() => scrollToSection(section.id)}
                tooltip={section.title}
                className="cursor-pointer"
              >
                <section.icon className="h-4 w-4" />
                <span className={cn({ 'sr-only': !open })}>
                  {section.title}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={navigateToApp}
              tooltip="Return to App"
              className="cursor-pointer"
            >
              <MessageSquare className="h-4 w-4" />
              <span className={cn({ 'sr-only': !open })}>Return to App</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
