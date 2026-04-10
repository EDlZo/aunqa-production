import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle, MessageSquare } from 'lucide-react';

const ElegantModal = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info', // 'success', 'error', 'info', 'warning', 'confirm', 'prompt'
    onConfirm,
    onCancel,
    confirmText = 'ตกลง',
    cancelText = 'ยกเลิก',
    promptPlaceholder = 'ระบุข้อความ...',
    defaultValue = '',
    loading = false
}) => {
    const [inputValue, setInputValue] = useState(defaultValue);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
            setInputValue(defaultValue);
        }
    }, [isOpen, defaultValue]);

    if (!isOpen && !isAnimating) return null;

    const getIcon = () => {
        const iconClass = "w-16 h-16 transition-transform duration-700 hover:scale-110";
        switch (type) {
            case 'success': return <CheckCircle2 className={`${iconClass} text-emerald-500`} strokeWidth={1.2} />;
            case 'error': return <AlertCircle className={`${iconClass} text-rose-500`} strokeWidth={1.2} />;
            case 'warning': return <AlertTriangle className={`${iconClass} text-amber-500`} strokeWidth={1.2} />;
            case 'confirm': return <MessageSquare className={`${iconClass} text-blue-500`} strokeWidth={1.2} />;
            case 'prompt': return <MessageSquare className={`${iconClass} text-rose-500`} strokeWidth={1.2} />;
            default: return <Info className={`${iconClass} text-blue-500`} strokeWidth={1.2} />;
        }
    };

    const handleConfirm = () => {
        if (type === 'prompt') {
            onConfirm(inputValue);
        } else {
            onConfirm();
        }
    };

    const typeStyles = {
        success: {
            bar: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
            btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)]',
            iconBg: 'bg-emerald-50/50'
        },
        error: {
            bar: 'bg-gradient-to-r from-rose-400 to-rose-600',
            btn: 'bg-rose-600 hover:bg-rose-700 shadow-[0_10px_20px_-5px_rgba(244,63,94,0.4)]',
            iconBg: 'bg-rose-50/50'
        },
        warning: {
            bar: 'bg-gradient-to-r from-amber-400 to-amber-600',
            btn: 'bg-amber-600 hover:bg-amber-700 shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)]',
            iconBg: 'bg-amber-50/50'
        },
        info: {
            bar: 'bg-gradient-to-r from-blue-400 to-blue-600',
            btn: 'bg-blue-600 hover:bg-blue-700 shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)]',
            iconBg: 'bg-blue-50/50'
        },
        confirm: {
            bar: 'bg-gradient-to-r from-slate-700 to-slate-900',
            btn: 'bg-slate-900 hover:bg-black shadow-[0_10px_20px_-5px_rgba(15,23,42,0.4)]',
            iconBg: 'bg-slate-50/50'
        },
        prompt: {
            bar: 'bg-gradient-to-r from-rose-400 to-rose-600',
            btn: 'bg-rose-600 hover:bg-rose-700 shadow-[0_10px_20px_-5px_rgba(244,63,94,0.4)]',
            iconBg: 'bg-rose-50/50'
        }
    };

    const currentStyle = typeStyles[type] || typeStyles.info;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-prompt">
            {/* Backdrop with extreme glassmorphism */}
            <div
                className={`fixed inset-0 bg-slate-950/20 backdrop-blur-[12px] transition-opacity duration-700 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={type !== 'prompt' ? onClose : undefined}
                onTransitionEnd={() => !isOpen && setIsAnimating(false)}
            />

            {/* Modal Content container */}
            <div className={`relative w-full max-w-xl mb-auto mt-auto transition-all duration-700 ease-out transform ${isOpen ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-12 scale-95 opacity-0'}`}>
                {/* Main Card with multi-layered shadows and subtle gradients */}
                <div className="relative bg-white/70 backdrop-blur-[32px] rounded-[3.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.6)_inset] border border-white/40 overflow-hidden">

                    {/* Animated Gradient Progress Bar */}
                    <div className={`h-2 w-full ${currentStyle.bar} animate-pulse shadow-sm`} />

                    <div className="p-12 sm:p-16 text-center">
                        {/* Elegant Icon Presentation */}
                        <div className="flex justify-center mb-10">
                            <div className="relative group">
                                <div className={`absolute inset-0 ${currentStyle.iconBg} rounded-[2.5rem] blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-700`} />
                                <div className="relative p-8 bg-white/40 backdrop-blur-md rounded-[2.8rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/80 ring-1 ring-black/5">
                                    {getIcon()}
                                </div>
                            </div>
                        </div>

                        <h3 className="text-4xl font-black text-slate-900 mb-6 tracking-tight leading-tight bg-gradient-to-b from-slate-900 to-slate-700 bg-clip-text">
                            {title}
                        </h3>

                        <div className="text-slate-500 text-xl leading-relaxed mb-12 font-medium px-6">
                            {message}
                        </div>

                        {type === 'prompt' && (
                            <div className="mb-12">
                                <textarea
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={promptPlaceholder}
                                    className="w-full px-8 py-6 bg-white/40 backdrop-blur-sm border-2 border-slate-100/50 rounded-[2.2rem] focus:ring-8 focus:ring-rose-500/5 focus:border-rose-400 outline-none transition-all min-h-[160px] text-slate-800 text-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]"
                                    autoFocus
                                />
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-5 px-4">
                            {(type === 'confirm' || type === 'prompt' || onCancel) && (
                                <button
                                    onClick={onCancel || onClose}
                                    className="flex-1 px-8 py-6 bg-slate-100/40 text-slate-600 font-bold text-lg rounded-[1.8rem] hover:bg-slate-200/50 transition-all active:scale-[0.98] border border-slate-200/30 backdrop-blur-sm"
                                >
                                    {cancelText}
                                </button>
                            )}
                            <button
                                onClick={handleConfirm}
                                disabled={loading}
                                className={`flex-1 px-8 py-6 font-black text-lg text-white rounded-[1.8rem] transition-all active:scale-[0.98] shadow-2xl relative overflow-hidden group ${currentStyle.btn} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {/* Shine Effect */}
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                                <span className="relative z-10">
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                                            <span>กำลังดำเนินการ...</span>
                                        </div>
                                    ) : confirmText}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Minimalist Close Button with Hover Effect */}
                    {type !== 'prompt' && (
                        <button
                            onClick={onClose}
                            className="absolute top-10 right-10 p-4 text-slate-400 hover:text-slate-900 hover:bg-slate-100/50 rounded-[1.5rem] transition-all duration-300"
                        >
                            <X size={28} strokeWidth={1.5} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ElegantModal;
