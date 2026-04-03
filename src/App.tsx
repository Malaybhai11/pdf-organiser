import React, { useState } from "react";
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

    const handleSelectCustomer = (customer: Customer | null) => {
        setSelectedCustomer(customer);
        setPreviewFile(null); // Reset preview when switching customers
    };

    const handlePreview = (fileName: string) => {
        setPreviewFile(fileName);
    };

    return (
        <div className="app-container">
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
                    <h2>{selectedCustomer ? `Customer: ${selectedCustomer.name} (${selectedCustomer.id})` : 'Customers'}</h2>
                    <div className="search-bar">
                        <input type="text" placeholder="Search..." disabled />
                    </div>
                </header>
                
                <div className="main-content">
                    {!selectedCustomer ? (
                        <CustomerList 
                            onSelect={handleSelectCustomer} 
                            onNotify={(message, type) => setGlobalNotification({ message, type })}
                        />
                    ) : (
                        <div>
                            <button className="back-btn" onClick={() => handleSelectCustomer(null)}>
                                ← Back to Customers
                            </button>
                            <Dashboard 
                                selectedCustomer={selectedCustomer} 
                                onPreview={handlePreview}
                            />
                        </div>
                    )}
                </div>
            </main>

            {previewFile && selectedCustomer && (
                <PdfPreview 
                    customerId={selectedCustomer.id.toString()} 
                    fileName={previewFile} 
                    onClose={() => setPreviewFile(null)} 
                />
            )}
        </div>
    );
};

export default App;
