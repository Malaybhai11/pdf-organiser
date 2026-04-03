import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
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
            
            <Sidebar 
                onSelectCustomer={handleSelectCustomer} 
                selectedCustomerId={selectedCustomer?.id || null} 
            />
            
            <main className="main-panel">
                <header className="panel-header">
                    <h2>{selectedCustomer ? `Customer: ${selectedCustomer.name}` : 'Document Management'}</h2>
                    <div className="search-bar">
                        <input type="text" placeholder="Global search..." disabled />
                    </div>
                </header>
                
                <div className="main-content">
                    <Dashboard 
                        selectedCustomer={selectedCustomer} 
                        onPreview={handlePreview}
                    />
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
