(function() {
    // लोकल स्टोरेज इंजन कनेक्शन
    let memoryStorage = JSON.parse(localStorage.getItem('_secure_tracker_index_key')) || [];
    let runtimeActiveEditID = null;

    // DOM मैपिंग
    const nodeForm = document.getElementById('tracker-form');
    const nodeHiddenId = document.getElementById('entry-id');
    const nodeCompany = document.getElementById('company');
    const nodeRole = document.getElementById('role');
    const nodeDateApplied = document.getElementById('date-applied');
    const nodeStatus = document.getElementById('status');
    const nodeInterview = document.getElementById('interview-date');
    const nodeFollowup = document.getElementById('followup-date');
    const nodeLink = document.getElementById('app-link');

    const nodeWidgetTitle = document.getElementById('widget-title');
    const nodeSaveBtn = document.getElementById('save-trigger');
    const nodeAbortBtn = document.getElementById('abort-trigger');
    
    const nodeSearch = document.getElementById('search-query');
    const nodeFilterState = document.getElementById('filter-state');
    const nodeSortOrder = document.getElementById('sort-order');
    const nodeRowsContainer = document.getElementById('render-target-rows');
    const nodeFallbackEmpty = document.getElementById('fallback-empty-state');
    const nodeExportBtn = document.getElementById('export-csv');

    // एनालिटिक्स काउंटर्स DOM
    const statTotal = document.getElementById('stat-total');
    const statAssess = document.getElementById('stat-assess');
    const statInterview = document.getElementById('stat-interview');
    const statOffers = document.getElementById('stat-offers');

    window.addEventListener('DOMContentLoaded', () => {
        nodeDateApplied.value = new Date().toISOString().split('T')[0];
        commitUIRenderLoop();
    });

    // नया / अपडेट रिकॉर्ड हैंडलर
    nodeForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const dataRecord = {
            id: nodeHiddenId.value || 'track_' + Math.random().toString(36).substring(2, 11),
            company: nodeCompany.value.trim(),
            role: nodeRole.value.trim(),
            dateApplied: nodeDateApplied.value,
            status: nodeStatus.value,
            interview: nodeInterview.value,
            followup: nodeFollowup.value,
            link: nodeLink.value.trim()
        };

        if (runtimeActiveEditID) {
            memoryStorage = memoryStorage.map(item => item.id === runtimeActiveEditID ? dataRecord : item);
            exitEditingModeContext();
        } else {
            memoryStorage.push(dataRecord);
        }

        saveToLocalStorageEngine();
        commitUIRenderLoop();
        flushFormFieldsValues();
    });

    // एनालिटिक्स की लाइव कैलकुलेशन
    function calculateMetrics() {
        statTotal.textContent = memoryStorage.length;
        statAssess.textContent = memoryStorage.filter(i => i.status === 'Assessment').length;
        statInterview.textContent = memoryStorage.filter(i => i.status === 'Interview').length;
        statOffers.textContent = memoryStorage.filter(i => i.status === 'Offer').length;
    }

    // यूआई और टेबल रेंडरिंग लूप
    function commitUIRenderLoop() {
        const searchVal = nodeSearch.value.toLowerCase();
        const activeFilter = nodeFilterState.value;
        const activeSort = nodeSortOrder.value;

        calculateMetrics();

        // 1. फ़िल्टरिंग
        let computedDataset = memoryStorage.filter(item => {
            const evaluationText = item.company.toLowerCase().includes(searchVal) || 
                                   item.role.toLowerCase().includes(searchVal);
            const evaluationStatus = (activeFilter === 'ALL') || (item.status === activeFilter);
            return evaluationText && evaluationStatus;
        });

        // 2. सॉर्टिंग (तारीख के हिसाब से)
        computedDataset.sort((a, b) => {
            const dateA = new Date(a.dateApplied);
            const dateB = new Date(b.dateApplied);
            return activeSort === 'NEWEST' ? dateB - dateA : dateA - dateB;
        });

        if (computedDataset.length === 0) {
            nodeRowsContainer.innerHTML = '';
            nodeFallbackEmpty.classList.remove('hidden');
            return;
        }
        nodeFallbackEmpty.classList.add('hidden');

        // Table HTML इंजेक्शन
        nodeRowsContainer.innerHTML = computedDataset.map(item => {
            const roundDisplayStr = item.interview ? `📅 Int: ${new Date(item.interview).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}` : '';
            const milestoneDisplayStr = item.followup ? `🔔 F-Up: ${item.followup}` : '';

            return `
                <tr>
                    <td>
                        <div class="primary-text">${xssFilterShield(item.company)}</div>
                        <div class="secondary-text">${xssFilterShield(item.role)}</div>
                    </td>
                    <td>${item.dateApplied}</td>
                    <td><span class="status-tag tag-${item.status.toLowerCase()}">${item.status}</span></td>
                    <td>
                        ${roundDisplayStr ? `<span class="date-timestamp-block">${roundDisplayStr}</span>` : ''}
                        ${milestoneDisplayStr ? `<span class="date-timestamp-block">${milestoneDisplayStr}</span>` : ''}
                        ${!roundDisplayStr && !milestoneDisplayStr ? '<span style="color:var(--text-muted)">—</span>' : ''}
                    </td>
                    <td>
                        ${item.link ? `<a href="${xssFilterShield(item.link)}" target="_blank" class="portal-redirect">Link ↗</a>` : '<span style="color:var(--text-muted)">—</span>'}
                    </td>
                    <td>
                        <button onclick="GlobalBridge.triggerEdit('${item.id}')" class="row-trigger trigger-modify">Edit</button>
                        <button onclick="GlobalBridge.triggerWipe('${item.id}')" class="row-trigger trigger-wipe">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // डेटा को Excel/CSV फॉर्मेट में डाउनलोड करने का एडवांस फ़ंक्शन
    nodeExportBtn.addEventListener('click', () => {
        if (memoryStorage.length === 0) {
            alert("No data available to export.");
            return;
        }
        let csvContent = "data:text/csv;charset=utf-8,Company,Role,Date Applied,Status,Interview Date,FollowUp Date,Link\n";
        
        memoryStorage.forEach(item => {
            let row = `"${item.company}","${item.role}","${item.dateApplied}","${item.status}","${item.interview || ''}","${item.followup || ''}","${item.link || ''}"`;
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Internship_Applications_Backup.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // ग्लोबल इंटरफ़ेस ब्रिजिग ऑपरेशंस
    window.GlobalBridge = {
        triggerEdit: function(targetId) {
            const selectedElement = memoryStorage.find(item => item.id === targetId);
            if (!selectedElement) return;

            runtimeActiveEditID = targetId;
            nodeHiddenId.value = selectedElement.id;
            nodeCompany.value = selectedElement.company;
            nodeRole.value = selectedElement.role;
            nodeDateApplied.value = selectedElement.dateApplied;
            nodeStatus.value = selectedElement.status;
            nodeInterview.value = selectedElement.interview || '';
            nodeFollowup.value = selectedElement.followup || '';
            nodeLink.value = selectedElement.link || '';

            nodeWidgetTitle.innerHTML = "✏️ Edit Tracking Record";
            nodeSaveBtn.textContent = "Apply Changes";
            nodeAbortBtn.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        triggerWipe: function(targetId) {
            if (confirm("Are you sure you want to permanently delete this application record?")) {
                memoryStorage = memoryStorage.filter(item => item.id !== targetId);
                if (runtimeActiveEditID === targetId) exitEditingModeContext();
                saveToLocalStorageEngine();
                commitUIRenderLoop();
            }
        }
    };

    nodeAbortBtn.addEventListener('click', () => {
        exitEditingModeContext();
        flushFormFieldsValues();
    });

    function exitEditingModeContext() {
        runtimeActiveEditID = null;
        nodeWidgetTitle.innerHTML = "📥 Track New Application";
        nodeSaveBtn.textContent = "Save to Dashboard";
        nodeAbortBtn.classList.add('hidden');
    }

    function flushFormFieldsValues() {
        nodeForm.reset();
        nodeHiddenId.value = '';
        nodeDateApplied.value = new Date().toISOString().split('T')[0];
    }

    function saveToLocalStorageEngine() {
        localStorage.setItem('_secure_tracker_index_key', JSON.stringify(memoryStorage));
    }

    nodeSearch.addEventListener('input', commitUIRenderLoop);
    nodeFilterState.addEventListener('change', commitUIRenderLoop);
    nodeSortOrder.addEventListener('change', commitUIRenderLoop);

    function xssFilterShield(rawTextString) {
        return rawTextString.replace(/[&<>'"]/g, capturedChar => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[capturedChar] || capturedChar));
    }
})();
