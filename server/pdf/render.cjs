const fs = require('fs');
const path = require('path');

function renderIndicator(template, ind) {
    let t = template;

    // Strip inline font-size from rich text content (Quill editor injects these)
    const stripInlineFontSize = (html) => {
        if (!html) return html;
        return html
            .replace(/font-size\s*:\s*[\d.]+pt\s*;?/gi, '')
            .replace(/font-size\s*:\s*[\d.]+px\s*;?/gi, '')
            .replace(/font-size\s*:\s*[\w.]+\s*;?/gi, '');
    };

    t = t.replace(/{{sequence}}/g, ind.sequence || '');
    t = t.replace(/{{display_sequence}}/g, ind.display_sequence || ind.sequence || '');
    t = t.replace(/{{indicator_name}}/g, ind.indicator_name || '');
    t = t.replace(/{{{evaluation_text}}}/g, stripInlineFontSize(ind.evaluation_text) || '');

    // Sub-criteria
    if (ind.has_sub_criteria && ind.sub_criteria_list && ind.sub_criteria_list.length > 0) {
        t = t.replace(/{{#has_sub_criteria}}([\s\S]*?){{\/has_sub_criteria}}/g, '$1');
        t = t.replace(/{{#sub_criteria_list}}([\s\S]*?){{\/sub_criteria_list}}/g, (_m, c) => {
            return (ind.sub_criteria_list || []).map((sc, idx) => {
                return c
                    .replace(/{{num}}/g, sc.num != null ? String(sc.num) : String(idx + 1))
                    .replace(/{{text}}/g, sc.text || '');
            }).join('');
        });
    } else {
        t = t.replace(/{{#has_sub_criteria}}([\s\S]*?){{\/has_sub_criteria}}/g, '');
    }

    // Score
    if (ind.score != null) {
        t = t.replace(/{{#score}}([\s\S]*?){{\/score}}/g, '$1');
        t = t.replace(/{{score}}/g, String(ind.score));
    } else {
        t = t.replace(/{{#score}}([\s\S]*?){{\/score}}/g, '');
    }

    // Target score
    if (ind.target_score != null) {
        t = t.replace(/{{#target_score}}([\s\S]*?){{\/target_score}}/g, '$1');
        t = t.replace(/{{target_score}}/g, String(ind.target_score));
    } else {
        t = t.replace(/{{#target_score}}([\s\S]*?){{\/target_score}}/g, '');
    }
    // Inverted target_score
    t = t.replace(/\{\{\^target_score\}\}([\s\S]*?)\{\{\/target_score\}\}/g, ind.target_score ? '' : '$1');

    // Goal achieved
    if (ind.goal_achieved != null) {
        if (ind.goal_achieved) {
            t = t.replace(/{{#goal_achieved}}([\s\S]*?){{\/goal_achieved}}/g, '$1');
            t = t.replace(/\{\{\^goal_achieved\}\}[\s\S]*?\{\{\/goal_achieved\}\}/g, '');
        } else {
            t = t.replace(/{{#goal_achieved}}[\s\S]*?{{\/goal_achieved}}/g, '');
            t = t.replace(/\{\{\^goal_achieved\}\}([\s\S]*?)\{\{\/goal_achieved\}\}/g, '$1');
        }
    } else {
        // If undefined, hide both blocks to be safe
        t = t.replace(/{{#goal_achieved}}[\s\S]*?{{\/goal_achieved}}/g, '');
        t = t.replace(/\{\{\^goal_achieved\}\}[\s\S]*?\{\{\/goal_achieved\}\}/g, '');
    }

    // Evidence
    if (ind.has_evidence) {
        t = t.replace(/{{#has_evidence}}([\s\S]*?){{\/has_evidence}}/g, '$1');
        t = t.replace(/{{#evidence_list}}([\s\S]*?){{\/evidence_list}}/g, (_m, c) => {
            return (ind.evidence_list || []).map(ev => {
                return c.replace(/{{number}}/g, ev.number || '').replace(/{{name}}/g, ev.name || '');
            }).join('');
        });
    } else {
        t = t.replace(/{{#has_evidence}}([\s\S]*?){{\/has_evidence}}/g, '');
    }

    return t;
}

function renderTemplate(html, data) {
    let result = html;
    console.log('[renderTemplate] components:', data.components?.length, 'first comp indicators:', data.components?.[0]?.indicators?.length);

    // Strip inline font-size from rich text fields
    const stripInlineFontSize = (html) => {
        if (!html) return html;
        return html
            .replace(/font-size\s*:\s*[\d.]+pt\s*;?/gi, '')
            .replace(/font-size\s*:\s*[\d.]+px\s*;?/gi, '')
            .replace(/font-size\s*:\s*[\w.]+\s*;?/gi, '');
    };

    // Strip from rich text data fields
    if (data.university_info) data = { ...data, university_info: stripInlineFontSize(data.university_info) };
    if (data.program_info) data = { ...data, program_info: stripInlineFontSize(data.program_info) };
    if (data.swot_s) data = { ...data, swot_s: stripInlineFontSize(data.swot_s) };
    if (data.swot_w) data = { ...data, swot_w: stripInlineFontSize(data.swot_w) };

    // Components loop
    if (data.components && Array.isArray(data.components)) {
        const componentRegex = /{{#components}}([\s\S]*?){{\/components}}/g;
        result = result.replace(componentRegex, (_m, compTemplate) => {
            return data.components.map((comp, compIdx) => {
                let compHtml = compTemplate;
                compHtml = compHtml.replace(/{{quality_name}}/g, comp.quality_name || '');
                // Add 'first-component' class to first component so it stays on same page as chapter banner
                compHtml = compHtml.replace(/class="component-section"/, compIdx === 0 ? 'class="component-section first-component"' : 'class="component-section"');

                const indicators = comp.indicators || [];

                // Build flat evidence list across all indicators for this component
                const allEvidence = [];
                let firstIndWithScore = null;
                indicators.forEach(ind => {
                    if (ind.has_evidence && ind.evidence_list) {
                        ind.evidence_list.forEach(ev => allEvidence.push(ev));
                    }
                    if (!firstIndWithScore && ind.score != null) {
                        firstIndWithScore = ind;
                    }
                });
                const hasAnyEvidence = allEvidence.length > 0;
                
                // If we found any score in indicators, but firstIndWithScore is still null, 
                // try just the first indicator as fallback
                if (!firstIndWithScore && indicators.length > 0) {
                    firstIndWithScore = indicators[0];
                }

                // Replace each {{#indicators}}...{{/indicators}} block independently
                compHtml = compHtml.replace(/{{#indicators}}([\s\S]*?){{\/indicators}}/g, (_m2, indTemplate) => {
                    return indicators.map(ind => renderIndicator(indTemplate, ind)).join('');
                });

                // Support {{#first_indicator}} helper to avoid duplication for component-level items
                compHtml = compHtml.replace(/{{#first_indicator}}([\s\S]*?){{\/first_indicator}}/g, (_m2, indTemplate) => {
                    if (!firstIndWithScore) return '';
                    console.log(`[first_indicator] Rendering score for ${firstIndWithScore.sequence}: ${firstIndWithScore.score}`);
                    return renderIndicator(indTemplate, firstIndWithScore);
                });

                // Evidence table
                if (hasAnyEvidence) {
                    compHtml = compHtml.replace(/{{#has_any_evidence}}([\s\S]*?){{\/has_any_evidence}}/g, '$1');
                    compHtml = compHtml.replace(/{{#all_evidence}}([\s\S]*?){{\/all_evidence}}/g, (_m2, evTemplate) => {
                        return allEvidence.map(ev => {
                            let row = evTemplate;
                            row = row.replace(/{{number}}/g, ev.number || '');
                            row = row.replace(/{{name}}/g, ev.name || '');
                            if (ev.url) {
                                row = row.replace(/{{#url}}([\s\S]*?){{\/url}}/g, '$1');
                                row = row.replace(/{{url}}/g, ev.url);
                                row = row.replace(/\{\{\^url\}\}[\s\S]*?\{\{\/url\}\}/g, '');
                            } else {
                                row = row.replace(/{{#url}}[\s\S]*?{{\/url}}/g, '');
                                row = row.replace(/\{\{\^url\}\}([\s\S]*?)\{\{\/url\}\}/g, '$1');
                                row = row.replace(/{{url}}/g, '');
                            }
                            return row;
                        }).join('');
                    });
                } else {
                    compHtml = compHtml.replace(/{{#has_any_evidence}}[\s\S]*?{{\/has_any_evidence}}/g, '');
                }

                return compHtml;
            }).join('');
        });
    }

    // Static variables
    Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string' || typeof data[key] === 'number') {
            result = result.replace(new RegExp(`\\{\\{\\{${key}\\}\\}\\}`, 'g'), data[key]);
            result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(data[key]).replace(/[&<>"']/g, m => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[m]));
        }
    });

    // Clean up any remaining unresolved tags
    result = result.replace(/{{#logo_url}}([\s\S]*?){{\/logo_url}}/g, data.logo_url ? '$1' : '');

    // Clean up any leftover block tags (safety net) — includes inverted {{^tag}}
    result = result.replace(/\{\{[#^\/][^}]+\}\}[\s\S]*?\{\{\/[^}]+\}\}/g, '');
    result = result.replace(/\{\{[#^\/][^}]+\}\}/g, '');
    result = result.replace(/\{\{\{[^}]+\}\}\}/g, '');
    result = result.replace(/\{\{[^}]+\}\}/g, '');

    return result;
}

module.exports = { renderTemplate };
