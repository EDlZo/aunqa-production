// src/components/Admin/MasterIndicatorsTable.jsx
import React, { useState, useMemo } from 'react';
import {
    Search, Edit2, Trash2, Plus, Type,
    Layers, ChevronDown, ChevronRight, Activity,
    Box, Filter, MoreHorizontal
} from 'lucide-react';

// Recursive Row Component for Level 2+ Accordion
const IndicatorRow = ({ item, depth = 0, onEdit, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = item.children && item.children.length > 0;

    return (
        <div className="flex flex-col border-b border-gray-100 last:border-0">
            <div className="flex items-center hover:bg-gray-50 group py-3 pr-4">
                <div
                    className="flex items-center"
                    style={{ paddingLeft: `${depth * 2}rem` }}
                >
                    {hasChildren ? (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors mr-1"
                        >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                    ) : (
                        <div className="w-6 mr-1" />
                    )}
                    <span className="text-sm font-medium text-gray-400 w-16 mr-2">
                        {item.sequence || '-'}
                    </span>
                </div>

                <div className="flex-1 text-sm text-gray-700">
                    {item.indicator_name}
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(item)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete(item.id)}
                        className="text-red-600 hover:text-red-900"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {hasChildren && isExpanded && (
                <div className="bg-gray-50/50">
                    {item.children.map(child => (
                        <IndicatorRow
                            key={child.id}
                            item={child}
                            depth={depth + 1}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function MasterIndicatorsTable({ items, components, onEdit, onDelete, onAdd }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedComponents, setExpandedComponents] = useState({});

    // 1. Build Tree and Filter
    const treeData = useMemo(() => {
        // Safe filter
        const filtered = items.filter(item => {
            const name = (item.indicator_name || '').toLowerCase();
            const seq = String(item.sequence || '').toLowerCase();
            const term = searchTerm.toLowerCase();
            return name.includes(term) || seq.includes(term);
        });

        // Group by component
        const compGroups = {};
        components.forEach(c => {
            compGroups[c.component_id] = { ...c, nodes: [] };
        });

        // Build hierarchy for each component
        filtered.forEach(item => {
            const group = compGroups[item.component_id];
            if (group) group.nodes.push({ ...item, children: [] });
        });

        // Convert flat nodes to trees within each group
        Object.values(compGroups).forEach(group => {
            const nodeMap = {};
            group.nodes.forEach(node => { nodeMap[node.id] = node; });

            const rootNodes = [];
            group.nodes.forEach(node => {
                if (node.parent_id && nodeMap[node.parent_id]) {
                    nodeMap[node.parent_id].children.push(node);
                } else {
                    rootNodes.push(node);
                }
            });

            // Sort root nodes by sequence
            rootNodes.sort((a, b) => String(a.sequence).localeCompare(String(b.sequence), undefined, { numeric: true }));
            group.tree = rootNodes;
        });

        return Object.values(compGroups)
            .filter(g => g.tree.length > 0 || (searchTerm === '' && g.quality_name))
            .sort((a, b) => (a.component_id || 0) - (b.component_id || 0));
    }, [items, components, searchTerm]);

    const toggleComponent = (id) => {
        setExpandedComponents(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6 p-2">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อตัวบ่งชี้หรือเลขลำดับ..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => onAdd()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                    <Plus className="w-5 h-5 mr-1" />
                    เพิ่มตัวบ่งชี้ใหม่
                </button>
            </div>

            <div className="space-y-4">
                {treeData.map((comp) => {
                    const isExpanded = expandedComponents[comp.id] !== false;
                    return (
                        <div key={comp.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                            <div
                                className="bg-gray-50 px-6 py-4 flex items-center justify-between cursor-pointer border-b border-gray-300"
                                onClick={() => toggleComponent(comp.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center text-white font-bold">
                                        {comp.component_id}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">{comp.quality_name}</h3>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-blue-600 font-medium">{comp.major_name || 'Global'}</span>
                                            <span className="text-gray-400">•</span>
                                            <span className="text-gray-500">{comp.tree.length} indicators</span>
                                        </div>
                                    </div>
                                </div>
                                <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''} text-gray-400`} />
                            </div>

                            {isExpanded && (
                                <div className="p-2">
                                    {comp.tree.length > 0 ? (
                                        comp.tree.map(node => (
                                            <IndicatorRow
                                                key={node.id}
                                                item={node}
                                                onEdit={onEdit}
                                                onDelete={onDelete}
                                            />
                                        ))
                                    ) : (
                                        <div className="py-8 text-center text-gray-400 italic text-sm">
                                            ไม่มีข้อมูลแสดงผล
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

