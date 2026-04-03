import React from 'react';
import { CustomerList } from './CustomerList';

interface SidebarProps {
  onSelectCustomer: (customer: any) => void;
  selectedCustomerId: string | number | null;
}

const Sidebar: React.FC<SidebarProps> = ({ onSelectCustomer, selectedCustomerId }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>DocManager</h2>
      </div>
      <CustomerList 
        onSelect={onSelectCustomer} 
        selectedId={selectedCustomerId} 
      />
    </aside>
  );
};

export default Sidebar;
