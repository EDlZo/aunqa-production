import React, { createContext, useContext, useState, useCallback } from 'react';
import ElegantModal from '../components/ElegantModal';

const ModalContext = createContext({
    showAlert: () => { },
    showConfirm: () => { },
    showPrompt: () => { },
    hideModal: () => { },
});

export const useModal = () => useContext(ModalContext);

export const ModalProvider = ({ children }) => {
    const [modalConfig, setModalConfig] = useState(null);

    const hideModal = useCallback(() => {
        setModalConfig(prev => prev ? { ...prev, isOpen: false } : null);
        // Allow animation to finish before clearing
        setTimeout(() => setModalConfig(null), 300);
    }, []);

    const showAlert = useCallback(({ title, message, type = 'info', confirmText = 'ตกลง', onConfirm }) => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            type,
            confirmText,
            onConfirm: () => {
                if (onConfirm) onConfirm();
                hideModal();
            }
        });
    }, [hideModal]);

    const showConfirm = useCallback(({ title, message, type = 'confirm', confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', onConfirm, onCancel }) => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            type,
            confirmText,
            cancelText,
            onConfirm: () => {
                if (onConfirm) onConfirm();
                hideModal();
            },
            onCancel: () => {
                if (onCancel) onCancel();
                hideModal();
            }
        });
    }, [hideModal]);

    const showPrompt = useCallback(({ title, message, defaultValue = '', placeholder = 'กรุณาระบุ...', confirmText = 'ส่งข้อมูล', cancelText = 'ยกเลิก', onConfirm, onCancel }) => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            type: 'prompt',
            defaultValue,
            promptPlaceholder: placeholder,
            confirmText,
            cancelText,
            onConfirm: (value) => {
                if (onConfirm) onConfirm(value);
                hideModal();
            },
            onCancel: () => {
                if (onCancel) onCancel();
                hideModal();
            }
        });
    }, [hideModal]);

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm, showPrompt, hideModal }}>
            {children}
            {modalConfig && (
                <ElegantModal
                    {...modalConfig}
                    onClose={hideModal}
                />
            )}
        </ModalContext.Provider>
    );
};
