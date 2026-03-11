import React from 'react';
import { LayoutDashboard, Box, Factory, Wallet, Settings, Bell, ChevronRight, LogOut, ClipboardList, ShoppingCart, Archive, User, Package, Zap } from 'lucide-react'; import { useApp } from '../contexts/AppContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory Center', icon: Box },
    { id: 'correspondence', label: 'Correspondence', icon: Archive },
    { id: 'production', label: 'Prod: Monitoring', icon: Factory },
    { id: 'production-report', label: 'Prod: Laporan (LHP)', icon: ClipboardList },
    { id: 'sales-auto-invoice', label: 'Automated Invoicing', icon: Zap },
    { id: 'purchasing', label: 'Purchasing (PO)', icon: ShoppingCart },
    { id: 'finance', label: 'Finance: Payroll', icon: Wallet },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 h-screen fixed left-0 top-0 text-white flex flex-col z-50 shadow-2xl border-r border-slate-800">
      <div className="p-8 border-b border-slate-800 bg-slate-900">
        <h1 className="text-2xl font-black tracking-tighter text-blue-400 italic flex items-center gap-2">
           <Package size={24} />
           GTP ERP
        </h1>
        <p className="text-[10px] text-slate-500 mt-1 uppercase font-black tracking-widest italic opacity-70">Premium Ledger V3.2</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar bg-slate-900">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center space-x-3 px-5 py-3.5 rounded-xl transition-all duration-300 group ${
              activeTab === item.id 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 translate-x-1' 
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <item.icon size={18} className={`transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span className="font-black text-[11px] uppercase tracking-widest">{item.label}</span>
            {activeTab === item.id && <ChevronRight size={12} className="ml-auto animate-pulse" />}
          </button>
        ))}
      </nav>

      <div className="p-6 border-t border-slate-800 bg-slate-900">
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
           <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xs text-white shadow-lg italic">AD</div>
           <div>
              <p className="text-[10px] font-black text-white uppercase tracking-tighter italic leading-none mb-1">Administrator</p>
              <p className="text-[9px] font-bold text-slate-500 uppercase leading-none">GTP WORKSHOP</p>
           </div>
        </div>
        <button className="flex items-center space-x-3 text-slate-500 hover:text-rose-400 transition-colors w-full px-4 py-2 group">
          <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest italic">Logout System</span>
        </button>
      </div>
    </aside>
  );
};

export const Header: React.FC<{ title: string }> = ({ title }) => {
  const { alerts, markAlertAsRead } = useApp();
  const unreadCount = alerts.filter(a => a.status === 'Unread').length;
  const [showNotif, setShowNotif] = React.useState(false);

  return (
    <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 fixed top-0 right-0 left-64 z-40 flex items-center justify-between px-8 shadow-sm">
      <div className="flex items-center gap-3">
         <div className="w-1.5 h-6 bg-blue-600 rounded-full shadow-sm shadow-blue-500/20"></div>
         <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">{title}</h2>
      </div>

      <div className="flex items-center space-x-6">
        <div className="relative">
          <button 
            onClick={() => setShowNotif(!showNotif)}
            className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-all relative group"
          >
            <Bell size={20} className="group-hover:rotate-12 transition-transform" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-600 text-white text-[8px] flex items-center justify-center rounded-full font-black border-2 border-white animate-bounce shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 mt-3 w-80 bg-white border-2 border-slate-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <span className="font-black text-slate-700 text-[10px] uppercase tracking-widest italic">System Notifications</span>
              </div>
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">No critical alerts detected</div>
                ) : (
                  alerts.map(a => (
                    <div 
                      key={a.id} 
                      onClick={() => markAlertAsRead(a.id)}
                      className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${a.status === 'Unread' ? 'bg-rose-50/30' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest border border-rose-200 px-1.5 py-0.5 rounded-sm">Stock Alert</span>
                        <span className="text-[8px] text-slate-400 font-bold italic">{new Date(a.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="font-black text-slate-800 text-[11px] mb-0.5 uppercase tracking-tight italic">{a.itemNama}</p>
                      <p className="text-[10px] text-slate-600 font-bold">Qty Available: <span className="text-rose-600 font-black">{a.currentStock}</span></p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-xl ring-4 ring-slate-100 italic transition-transform hover:scale-105 cursor-pointer">AD</div>
      </div>
    </header>
  );
};