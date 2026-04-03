import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen, FolderPlus, MoreHorizontal, SearchX, Upload } from 'lucide-react';

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
  searchQuery: string;
}

export function CustomerList({ onSelect, onNotify, searchQuery }: CustomerListProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [dragOverId, setDragOverId] = useState<string | number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; customer: Customer | null }>({
    visible: false,
    x: 0,
    y: 0,
    customer: null,
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu((current) => ({ ...current, visible: false }));
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
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

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return customers;
    }

    return customers.filter((customer) =>
      customer.name.toLowerCase().includes(query) ||
      customer.id.toString().toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const customerId = newId.trim();
    const customerName = newName.trim();

    if (!customerId || !customerName) return;

    try {
      const response = await invoke<ApiResponse<void>>("create_customer_folder", { 
        customerId,
        name: customerName,
      });
      if (response.success) {
        setNewId("");
        setNewName("");
        setShowAddModal(false);
        await loadCustomers();
        onNotify(`Created customer ${customerName}`, 'success');
      } else {
        onNotify(response.error || 'Failed to create customer', 'error');
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
                const response = await invoke<ApiResponse<string>>('save_customer_file', {
                    customerId: customer.id.toString(),
                    fileName: file.name,
                    fileData: Array.from(uint8Array)
                });

                if (response.success) {
                    successCount++;
                } else {
                    onNotify(response.error || `Upload failed for ${file.name}`, 'error');
                }
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

  const openContextMenu = (e: React.MouseEvent | React.KeyboardEvent, customer: Customer) => {
    e.stopPropagation();
    e.preventDefault();
    setContextMenu({
        visible: true,
        x: 'clientX' in e ? e.clientX : window.innerWidth / 2,
        y: 'clientY' in e ? e.clientY : window.innerHeight / 2,
        customer
    });
  };

  const handleDeleteFolder = async () => {
    if (contextMenu.customer) {
        const confirmDelete = window.confirm(`Are you sure you want to permanently delete customer ${contextMenu.customer.name} and ALL their files?`);
        if (confirmDelete) {
            try {
                const response = await invoke<ApiResponse<void>>('delete_customer', { customerId: contextMenu.customer.id.toString() });
                if (response.success) {
                    onNotify(`Deleted customer ${contextMenu.customer.name}`, 'success');
                    await loadCustomers();
                } else {
                    onNotify(response.error || 'Failed to delete customer', 'error');
                }
            } catch (err) {
                onNotify('Failed to delete customer', 'error');
            }
        }
    }
    setContextMenu((current) => ({ ...current, visible: false }));
  };

  if (isLoading) return <div className="loading-state">Loading customer workspaces...</div>;

  return (
    <div className="customer-list-container">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Workspaces</span>
          <h2>Customer folders</h2>
          <p>Open a workspace to manage documents, or drag files directly onto a card to upload them instantly.</p>
        </div>

        <div className="customer-toolbar">
          <div className="stat-pill">
            <strong>{customers.length}</strong>
            <span>active customers</span>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <FolderPlus size={16} />
            New Customer
          </button>
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-state-icon">
            <SearchX size={28} />
          </div>
          <h3>{customers.length === 0 ? 'No customers yet' : 'No matching customers'}</h3>
          <p>
            {customers.length === 0
              ? 'Create the first customer workspace to start uploading and merging documents.'
              : `Nothing matches "${searchQuery}". Try a different name or customer ID.`}
          </p>
          {customers.length === 0 && (
            <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <FolderPlus size={16} />
              Create First Customer
            </button>
          )}
        </div>
      ) : (
        <div className="customer-grid">
          {filteredCustomers.map((customer) => (
            <div 
              key={customer.id}
              className={`folder-item ${dragOverId === customer.id ? 'drag-over' : ''}`}
              onClick={() => onSelect(customer)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(customer);
                }
              }}
              onContextMenu={(e) => openContextMenu(e, customer)}
              onDragOver={(e) => onDragOver(e, customer.id)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, customer)}
              role="button"
              tabIndex={0}
            >
              <button
                type="button"
                className="card-menu-btn"
                onClick={(e) => openContextMenu(e, customer)}
                aria-label={`Open actions for ${customer.name}`}
              >
                <MoreHorizontal size={16} />
              </button>

              <div className="folder-icon">
                <FolderOpen size={34} />
              </div>

              <div className="folder-copy">
                <span className="folder-name">{customer.name}</span>
                <span className="folder-id">ID {customer.id}</span>
                <span className="folder-hint">
                  <Upload size={14} />
                  Drop files here or open workspace
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {contextMenu.visible && (
        <div 
            className="context-menu" 
            style={{ 
                top: contextMenu.y, 
                left: contextMenu.x 
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <button type="button" className="context-menu-item delete-item" onClick={handleDeleteFolder}>
                Delete Customer
            </button>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="section-kicker">Create workspace</span>
              <h3>Add New Customer</h3>
              <p>Use a stable customer ID so exports and uploads stay organized.</p>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Workspace</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
