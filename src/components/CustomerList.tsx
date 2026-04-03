import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Customer {
  id: string | number;
  name: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface CustomerListProps {
  onSelect: (customer: Customer | null) => void;
  selectedId: string | number | null;
}

type SearchStatus = "searching" | "found" | "not_found" | null;

interface StatusIconProps {
  id: string | number;
  searchStatuses: Record<string, SearchStatus>;
  onAction: () => void;
}

function StatusIcon({ id, searchStatuses, onAction }: StatusIconProps) {
  const idStr = typeof id === "string" ? id : id.toString();
  const searchStatus = searchStatuses[idStr] || null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction();
  };

  if (searchStatus === "searching") {
    return <span className="status-badge status-searching">...</span>;
  }
  if (searchStatus === "found") {
    return <span className="status-badge status-found">✓</span>;
  }
  if (searchStatus === "not_found") {
    return <span className="status-badge status-not-found">✗</span>;
  }
  
  return (
    <button className="icon-btn search-btn" title="Search locally" onClick={handleClick}>
      🔍
    </button>
  );
}

export function CustomerList({ onSelect, selectedId }: CustomerListProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [searchStatuses, setSearchStatuses] = useState<Record<string, SearchStatus>>({});

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      // Prioritize the command that includes names if available
      const response = await invoke<ApiResponse<Customer[]>>("get_customers_with_names");
      if (response.success && response.data) {
        setCustomers(response.data);
      } else {
        // Fallback for older server version
        const resp = await invoke<ApiResponse<string[]>>("get_customers");
        if (resp.success && resp.data) {
          setCustomers(resp.data.map(id => ({ id: id, name: id })));
        }
      }
    } catch (error) {
      console.error("Failed to load customers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const idInput = form.elements.namedItem("customerId") as HTMLInputElement;
    const nameInput = form.elements.namedItem("customerName") as HTMLInputElement;
    const id = idInput.value.trim();
    const name = nameInput.value.trim();
    if (!id || !name) return;

    try {
      const response = await invoke<ApiResponse<void>>("create_customer_folder", { 
        customerId: id,
        name 
      });
      if (response.success) {
        idInput.value = "";
        nameInput.value = "";
        await loadCustomers();
      }
    } catch (error) {
      console.error("Failed to create customer:", error);
    }
  };

  const deleteCustomer = async (id: string | number) => {
    if (!confirm("Are you sure you want to delete this customer and all their files?")) return;
    const idStr = typeof id === "string" ? id : id.toString();
    try {
      const response = await invoke<ApiResponse<void>>("delete_customer", { customerId: idStr });
      if (response.success) {
        setCustomers(prev => prev.filter(c => c.id.toString() !== idStr));
        if (selectedId === id) onSelect(null);
      }
    } catch (error) {
      console.error("Failed to delete customer:", error);
    }
  };

  const startEditing = (customer: Customer) => {
    setEditingId(customer.id.toString());
    setEditName(customer.name);
  };

  const handleUpdateName = async (id: string | number) => {
    if (!editName.trim()) return;
    const idStr = typeof id === "string" ? id : id.toString();
    try {
      const response = await invoke<ApiResponse<void>>("update_customer_name", { 
        customerId: idStr, 
        name: editName.trim() 
      });
      if (response.success) {
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim() } : { ...c }));
        setEditingId(null);
      }
    } catch (error) {
      console.error("Failed to update customer name:", error);
    }
  };

  const searchMissingImages = async (customer: Customer) => {
    const idStr = customer.id.toString();
    setSearchStatuses(prev => ({ ...prev, [idStr]: "searching" }));
    
    try {
      const resp = await invoke<ApiResponse<boolean>>("search_missing_images", {
        customerId: idStr
      });
      
      setSearchStatuses(prev => ({ 
        ...prev, 
        [idStr]: resp.success && resp.data ? "found" : "not_found" 
      }));

      if (resp.success && resp.data) {
        if (selectedId === customer.id) {
          onSelect({...customer}); 
        }
      }
    } catch (err) {
      console.error("Search failed:", err);
      setSearchStatuses(prev => ({ ...prev, [idStr]: "not_found" }));
    }
  };

  if (isLoading) return <div className="loading">Loading customers...</div>;

  return (
    <div className="customer-list-container">
      <div className="header-row">
        <h3>Customers ({customers.length})</h3>
      </div>

      <form className="add-customer-form" onSubmit={handleCreateCustomer}>
        <div className="form-row">
          <input type="text" name="customerId" placeholder="ID" required style={{ width: '60px' }} />
          <input type="text" name="customerName" placeholder="Name..." required style={{ flex: 1 }} />
          <button type="submit" className="primary-btn">+</button>
        </div>
      </form>

      <div className="customer-scroll-area">
        {customers.length === 0 ? (
          <p className="empty-msg">No customers found.</p>
        ) : (
          customers.map(customer => (
            <div 
              key={customer.id} 
              className={`customer-item ${selectedId === (typeof customer.id === 'string' ? customer.id : customer.id) ? 'selected' : ''}`}
              onClick={() => onSelect(customer)}
            >
              <div className="customer-info">
                {editingId === customer.id.toString() ? (
                  <div className="edit-box" onClick={e => e.stopPropagation()}>
                    <input 
                      autoFocus
                      className="edit-input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleUpdateName(customer.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button onClick={() => handleUpdateName(customer.id)}>✓</button>
                    <button onClick={() => setEditingId(null)}>✗</button>
                  </div>
                ) : (
                  <>
                    <span className="customer-name">{customer.name}</span>
                    <span className="customer-id">#{customer.id}</span>
                  </>
                )}
              </div>
              <div className="customer-actions" onClick={e => e.stopPropagation()}>
                <StatusIcon 
                  id={customer.id} 
                  searchStatuses={searchStatuses} 
                  onAction={() => searchMissingImages(customer)} 
                />
                <button className="icon-btn edit-btn" onClick={() => startEditing(customer)}>✎</button>
                <button className="icon-btn delete-btn" onClick={() => deleteCustomer(customer.id)}>🗑</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
