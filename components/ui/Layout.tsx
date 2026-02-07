import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Calendar,
  Link as LinkIcon,
  Settings,
  LogOut,
  Menu, // Mobile menu icon
  X,
  Puzzle,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
  Zap,
  Rocket,
} from 'lucide-react';
import { ViewState, User } from '../../types';
import { useTheme } from './ThemeContext';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  user: User;
}

type MenuGroup = {
  title: string;
  items: {
    view: ViewState;
    label: string;
    icon: React.ElementType;
  }[];
};

const menuGroups: MenuGroup[] = [
  {
    title: 'Visão Geral',
    items: [
      { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Produtos',
    items: [
      { view: 'products', label: 'Meus Produtos', icon: Package },
      { view: 'quickpost', label: 'Quick Post', icon: Rocket },
      { view: 'integrations', label: 'Integrações', icon: Puzzle },
    ],
  },
  {
    title: 'Automação',
    items: [
      { view: 'schedule', label: 'Agendamentos', icon: Calendar },
      { view: 'templates', label: 'Templates de Venda', icon: MessageSquare },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { view: 'settings', label: 'Configurações', icon: Settings },
    ],
  },
];

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentView,
  onChangeView,
  onLogout,
  user
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(['Produtos', 'Automação']);

  const toggleGroup = (title: string) => {
    setOpenGroups(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  const isCollapsed = !isSidebarHovered && !isMobileMenuOpen;

  return (
    <div className="min-h-screen flex bg-[var(--color-bg-main)] transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-[var(--color-bg-card)] border-r border-[var(--color-border)] transform transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0 w-64' : 'lg:translate-x-0'}
          ${isSidebarHovered ? 'lg:w-64 shadow-2xl' : 'lg:w-20'}
        `}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        {/* Logo Area */}
        <div className={`flex items-center h-16 px-4 border-b border-[var(--color-border)] ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <button
            onClick={() => onChangeView('dashboard')}
            className="flex items-center space-x-3 overflow-hidden whitespace-nowrap hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex-shrink-0 flex items-center justify-center shadow-lg shadow-emerald-500/20 cursor-pointer">
              <Zap className="text-white w-6 h-6 fill-current" />
            </div>
            <span className={`text-xl font-bold text-[var(--color-text-main)] tracking-tight transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
              FlowMaster<span className="text-emerald-500">IA</span>
            </span>
          </button>
          <button onClick={() => setIsMobileMenuOpen(false)} className={`lg:hidden text-[var(--color-text-muted)] ${isCollapsed && 'hidden'}`}>
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-4 overflow-y-auto h-[calc(100vh-140px)] scrollbar-hide">
          {menuGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {!isCollapsed && (
                <div
                  className="px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-[var(--color-text-main)]"
                  onClick={() => toggleGroup(group.title)}
                >
                  <span className="line-clamp-1">{group.title}</span>
                  {openGroups.includes(group.title) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              )}

              <div className={`space-y-1 ${(isCollapsed || openGroups.includes(group.title)) ? 'block' : 'hidden'}`}>
                {group.items.map((item) => {
                  const isActive = currentView === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => {
                        onChangeView(item.view);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative
                        ${isActive
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-main)] hover:text-[var(--color-text-main)]'
                        }
                      `}
                    >
                      <item.icon size={22} className={`flex-shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500'}`} />

                      <span className={`ml-3 whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                        {item.label}
                      </span>

                      {/* Tooltip for collapsed mode */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none">
                          {item.label}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 w-full p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center p-3 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-bg-main)] hover:text-[var(--color-text-main)] transition-colors justify-center lg:justify-start`}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span className={`ml-3 whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
              {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            </span>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center p-3 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors justify-center lg:justify-start"
          >
            <LogOut size={20} />
            <span className={`ml-3 whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
              Sair
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* Topbar */}
        <header className="bg-[var(--color-bg-card)] border-b border-[var(--color-border)] sticky top-0 z-30 h-16">
          <div className="flex items-center justify-between px-4 h-full">
            <div className="flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
              >
                <Menu size={24} />
              </button>
              <h2 className="ml-4 text-lg font-semibold text-[var(--color-text-main)] hidden sm:block capitalize">
                {currentView}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-medium text-[var(--color-text-main)]">{user.name}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{user.email}</span>
              </div>
              <div className="h-9 w-9 rounded-full bg-emerald-100 border-2 border-emerald-500/20 overflow-hidden flex items-center justify-center">
                {user.avatar.includes('http') ? (
                  <img src={user.avatar} alt="User" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-emerald-700 font-bold">{user.name.charAt(0)}</span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};