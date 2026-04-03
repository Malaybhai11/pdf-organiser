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
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function CustomerList({ onSelect, onNotify }: CustomerListProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [dragOverId, setDragOverId] = useState<string | number | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await invoke<ApiResponse<Customer[]>>("get_customers_with_names");
      if (response.success && response.data) {
        setCustomers(response.data);
      } else {
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
    if (!newId || !newName) return;

    try {
      const response = await invoke<ApiResponse<void>>("create_customer_folder", { 
        customerId: newId,
        name: newName 
      });
      if (response.success) {
        setNewId("");
        setNewName("");
        setShowAddModal(false);
        await loadCustomers();
        onNotify(`Created customer ${newName}`, 'success');
      }
    } catch (error) {
      console.error("Failed to create customer:", error);
      onNotify("Failed to create customer", 'error');
    }
  };

  const onDragOver = (e: React.DragEvent, id: string | number) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const onDragLeave = () => {
    setDragOverId(null);
  };

    const [contextMenu, setContextMenu] = useState<{visible: boolean, x: number, y: number, customer: Customer | null}>({visible: false, x: 0, y: 0, customer: null});

    useEffect(() => {
        const handleClickOutside = () => {
          setContextMenu({ ...contextMenu, visible: false });
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [contextMenu]);

  const onDrop = async (e: React.DragEvent, customer: Customer) => {
    e.preventDefault();
    setDragOverId(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        let successCount = 0;
        
        for (const file of files) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                await invoke('save_customer_file', {
                    customerId: customer.id.toString(),
                    fileName: file.name,
                    fileData: Array.from(uint8Array)
                });
                successCount++;
            } catch (err) {
                console.error(`Upload failed for ${file.name}:`, err);
                onNotify(`Upload failed for ${file.name}`, 'error');
            }
        }
        
        if (successCount > 0) {
            onNotify(`Uploaded ${successCount} file(s) to ${customer.name}`, 'success');
        }
    }
  };

  const handleFolderClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    e.preventDefault();
    setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        customer
    });
  };

  const handleDeleteFolder = async () => {
    if (contextMenu.customer) {
        const confirmDelete = window.confirm(`Are you sure you want to permanently delete customer ${contextMenu.customer.name} and ALL their files?`);
        if (confirmDelete) {
            try {
                await invoke('delete_customer', { customerId: contextMenu.customer.id.toString() });
                onNotify(`Deleted customer ${contextMenu.customer.name}`, 'success');
                await loadCustomers();
            } catch (err) {
                onNotify('Failed to delete customer', 'error');
            }
        }
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  if (isLoading) return <div className="loading" style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Loading...</div>;

  return (
    <div className="customer-list-container" style={{ position: 'relative' }}>
      <div className="customer-grid">
        <div className="add-folder-btn" onClick={() => setShowAddModal(true)}>
          <span style={{ fontSize: '2.5rem', fontWeight: '200' }}>+</span>
          <span className="folder-name">New Customer</span>
        </div>

        {customers.map(customer => (
          <div 
            key={customer.id} 
            className={`folder-item ${dragOverId === customer.id ? 'drag-over' : ''}`}
            onDoubleClick={() => onSelect(customer)}
            onClick={(e) => handleFolderClick(e, customer)}
            onDragOver={(e) => onDragOver(e, customer.id)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, customer)}
          >
            <div className="folder-icon"></div>
            <span className="folder-name">{customer.name}</span>
            <span className="folder-id">ID: {customer.id}</span>
          </div>
        ))}
      </div>

      {contextMenu.visible && (
        <div 
            className="context-menu" 
            style={{ 
                top: contextMenu.y, 
                left: contextMenu.x 
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="context-menu-item delete-item" onClick={handleDeleteFolder}>
                Delete Customer
            </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Customer</h3>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <label>Customer ID</label>
                <input 
                  type="text" 
                  value={newId} 
                  onChange={e => setNewId(e.target.value)} 
                  placeholder="e.g. 1001"
                  required 
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Customer Name</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  placeholder="Full Name"
                  required 
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
