import React, { useState } from "react";
import { ArrowLeft, Search, Sparkles } from "lucide-react";
import { CustomerList } from "./components/CustomerList";
import Dashboard from "./components/Dashboard";
import { Notification } from "./components/Notification";
import { PdfPreview } from "./PdfPreview";
import "./App.css";

interface Customer {
  id: string | number;
  name: string;
}

const App: React.FC = () => {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [globalNotification, setGlobalNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [previewFile, setPreviewFile] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const handleSelectCustomer = (customer: Customer | null) => {
        setSelectedCustomer(customer);
        setPreviewFile(null);
    };

    const handlePreview = (fileName: string) => {
        setPreviewFile(fileName);
    };

    const notify = (message: string, type: 'success' | 'error' | 'info') => {
        setGlobalNotification({ message, type });
    };

    const headerTitle = selectedCustomer ? selectedCustomer.name : "Customer Document Hub";
    const headerSubtitle = selectedCustomer
        ? "Review uploads, preview pages, and export a polished merged PDF straight to Downloads."
        : "Create clean customer workspaces, drop files quickly, and keep every PDF batch ready to export.";

    return (
        <div className="app-container">
            <div className="app-ambient app-ambient-one" />
            <div className="app-ambient app-ambient-two" />

            {globalNotification && (
                <div className="global-notification">
                    <Notification 
                        message={globalNotification.message} 
                        type={globalNotification.type} 
                        onClose={() => setGlobalNotification(null)} 
                    />
                </div>
            )}
            
            <main className="main-panel">
                <header className="panel-header">
                    <div className="panel-brand">
                        <span className="panel-eyebrow">
                            <Sparkles size={14} />
                            PDF Organiser
                        </span>
                        <div>
                            <h1>{headerTitle}</h1>
                            <p>{headerSubtitle}</p>
                        </div>
                    </div>

                    <div className="panel-tools">
                        {selectedCustomer ? (
                            <>
                                <div className="customer-pill">Customer ID {selectedCustomer.id}</div>
                                <button className="btn btn-secondary" onClick={() => handleSelectCustomer(null)}>
                                    <ArrowLeft size={16} />
                                    Back to Customers
                                </button>
                            </>
                        ) : (
                            <label className="search-shell" aria-label="Search customers">
                                <Search size={18} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search by customer name or ID"
                                />
                            </label>
                        )}
                    </div>
                </header>
                
                <div className="main-content">
                    {!selectedCustomer ? (
                        <CustomerList 
                            onSelect={handleSelectCustomer} 
                            onNotify={notify}
                            searchQuery={searchQuery}
                        />
                    ) : (
                        <Dashboard 
                            selectedCustomer={selectedCustomer} 
                            onPreview={handlePreview}
                        />
                    )}
                </div>
            </main>

            {previewFile && selectedCustomer && (
                <PdfPreview 
                    customerId={selectedCustomer.id.toString()} 
                    fileName={previewFile} 
                    onClose={() => setPreviewFile(null)} 
                    onNotify={notify}
                />
            )}
        </div>
    );
};

export default App;
