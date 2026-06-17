let records = [];
let currentImages = [];
const STORAGE_KEY = 'inspecao_refrigeracao_data';
const HEADER_STORAGE_KEY = 'inspecao_refrigeracao_header';

const modal = document.getElementById('modal-container');
const fabAdd = document.getElementById('fab-add');
const closeModalBtns = document.querySelectorAll('.close-modal');
const recordForm = document.getElementById('record-form');
const headerForm = document.getElementById('inspection-header');
const recordsContainer = document.getElementById('records-container');
const imageUpload = document.getElementById('image-upload');
const imagePreview = document.getElementById('image-preview');
const btnGeneratePdf = document.getElementById('btn-generate-pdf');

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderRecords();
    
    const dateInput = document.getElementById('data');
    if (!dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
});

fabAdd.addEventListener('click', () => {
    openModal();
});

closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        closeModal();
    });
});

window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

recordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveRecord();
});

imageUpload.addEventListener('change', handleImageUpload);

btnGeneratePdf.addEventListener('click', generatePDF);

headerForm.addEventListener('input', () => {
    const headerData = {
        loja: document.getElementById('loja').value,
        bandeira: document.getElementById('bandeira').value,
        colaborador: document.getElementById('colaborador').value,
        matricula: document.getElementById('matricula').value,
        data: document.getElementById('data').value
    };
    localStorage.setItem(HEADER_STORAGE_KEY, JSON.stringify(headerData));
});

function openModal(editId = null) {
    recordForm.reset();
    document.getElementById('edit-id').value = editId || '';
    document.getElementById('modal-title-text').innerText = editId ? 'Editar Porta / Local' : 'Adicionar Porta / Local';
    currentImages = [];
    imagePreview.innerHTML = '';
    
    if (editId) {
        const record = records.find(r => r.id === editId);
        if (record) {
            document.getElementById('local-title').value = record.title;
            document.getElementById('observations').value = record.observations;
            
            // Preencher avaliações
            for (const [key, value] of Object.entries(record.evaluations)) {
                const radio = recordForm.querySelector(`input[name="${key}"][value="${value}"]`);
                if (radio) radio.checked = true;
            }
            
            currentImages = [...record.images];
            renderImagePreviews();
        }
    }
    
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
}

function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                currentImages.push(compressedDataUrl);
                renderImagePreviews();
            };
        };
        reader.readAsDataURL(file);
    });
}

function renderImagePreviews() {
    imagePreview.innerHTML = '';
    currentImages.forEach((imgData, index) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <img src="${imgData}">
            <span class="remove-img" onclick="removeImage(${index})">&times;</span>
        `;
        imagePreview.appendChild(div);
    });
}

function removeImage(index) {
    currentImages.splice(index, 1);
    renderImagePreviews();
}

function saveRecord() {
    const title = document.getElementById('local-title').value;
    const editId = document.getElementById('edit-id').value;
    
    if (!title) {
        showToast('Preencha o título obrigatório.', 'error');
        return;
    }

    const evaluations = {};
    const evalNames = [
        'alarmes_porta', 'protetor_porta', 'evaporadora', 'piso', 'paineis'
    ];
    
    let allAnswered = true;
    evalNames.forEach(name => {
        const selected = recordForm.querySelector(`input[name="${name}"]:checked`);
        if (!selected) {
            allAnswered = false;
        } else {
            evaluations[name] = selected.value;
        }
    });

    if (!allAnswered) {
        showToast('Preencha todos os campos obrigatórios.', 'error');
        return;
    }

    const recordData = {
        id: editId || Date.now().toString(),
        title,
        evaluations,
        observations: document.getElementById('observations').value,
        images: currentImages
    };

    if (editId) {
        const index = records.findIndex(r => r.id === editId);
        records[index] = recordData;
        showToast('Porta/Local atualizado com sucesso.', 'success');
    } else {
        records.push(recordData);
        showToast('Porta/Local adicionado com sucesso.', 'success');
    }

    saveToStorage();
    renderRecords();
    closeModal();
}

function deleteRecord(id) {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
        records = records.filter(r => r.id !== id);
        saveToStorage();
        renderRecords();
        showToast('Registro excluído.', 'success');
    }
}

function renderRecords() {
    recordsContainer.innerHTML = '';
    
    if (records.length === 0) {
        recordsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #777; padding: 40px;">Nenhum registro adicionado ainda.</p>';
        return;
    }

    records.forEach(record => {
        const card = document.createElement('div');
        card.className = 'record-card';
        
        const simCount = Object.values(record.evaluations).filter(v => v === 'Sim').length;
        const totalCount = Object.values(record.evaluations).length;

        card.innerHTML = `
            <h3>${record.title}</h3>
            <p class="record-summary">
                <i class="fas fa-check-circle"></i> ${simCount}/${totalCount} itens em conformidade<br>
                <i class="fas fa-camera"></i> ${record.images.length} imagens anexadas
            </p>
            <div class="record-actions">
                <button class="btn-edit" onclick="openModal('${record.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-delete" onclick="deleteRecord('${record.id}')">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        `;
        recordsContainer.appendChild(card);
    });
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function loadData() {
    const savedRecords = localStorage.getItem(STORAGE_KEY);
    if (savedRecords) records = JSON.parse(savedRecords);
    
    const savedHeader = localStorage.getItem(HEADER_STORAGE_KEY);
    if (savedHeader) {
        const headerData = JSON.parse(savedHeader);
        document.getElementById('loja').value = headerData.loja || '';
        document.getElementById('bandeira').value = headerData.bandeira || '';
        document.getElementById('colaborador').value = headerData.colaborador || '';
        document.getElementById('matricula').value = headerData.matricula || '';
        document.getElementById('data').value = headerData.data || new Date().toISOString().split('T')[0];
    }
}

function showToast(message, type) {
    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: type === 'success' ? "#27ae60" : "#e30613",
    }).showToast();
}

async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const loja = document.getElementById('loja').value;
    const bandeira = document.getElementById('bandeira').value;
    const colaborador = document.getElementById('colaborador').value;
    const matricula = document.getElementById('matricula').value;
    const data = document.getElementById('data').value;

    if (!loja || !bandeira || !colaborador || !matricula || !data) {
        showToast('Preencha todos os dados do cabeçalho antes de gerar o PDF.', 'error');
        return;
    }

    if (records.length === 0) {
        showToast('Adicione pelo menos um Porta/Local para gerar o relatório.', 'error');
        return;
    }

    showToast('Gerando PDF...', 'success');

    try {
        const logoImg = new Image();
        logoImg.src = 'logo-grupo-pereira.png';
        await new Promise((resolve) => {
            logoImg.onload = resolve;
            logoImg.onerror = resolve; 
        });
        if (logoImg.complete && logoImg.naturalWidth > 0) {
            doc.addImage(logoImg, 'PNG', 80, 20, 50, 25);
        }
    } catch (e) { console.error('Logo error', e); }

    doc.setFontSize(18);
    doc.setTextColor(227, 6, 19);
    doc.text('RELATÓRIO DE INSPEÇÃO', 105, 60, { align: 'center' });
    doc.text('SISTEMA DE REFRIGERAÇÃO', 105, 70, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(44, 62, 80);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 80, 190, 80);

    const headerY = 90;
    doc.setFont("helvetica", "bold");
    doc.text('Loja:', 20, headerY);
    doc.text('Bandeira:', 20, headerY + 10);
    doc.text('Colaborador:', 20, headerY + 20);
    doc.text('Matrícula:', 20, headerY + 30);
    doc.text('Data:', 20, headerY + 40);

    doc.setFont("helvetica", "normal");
    doc.text(loja, 60, headerY);
    doc.text(bandeira, 60, headerY + 10);
    doc.text(colaborador, 60, headerY + 20);
    doc.text(matricula, 60, headerY + 30);
    doc.text(data.split('-').reverse().join('/'), 60, headerY + 40);

    for (const record of records) {
        doc.addPage();
        
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(`Relatório de Inspeção - ${loja} - ${data}`, 20, 10);
        doc.line(20, 12, 190, 12);

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(227, 6, 19);
        doc.text(record.title, 20, 25);

        const tableData = [
            ['Alarmes de Porta Aberta', record.evaluations.alarmes_porta],
            ['Protetor de Porta', record.evaluations.protetor_porta],
            ['Evaporadora', record.evaluations.evaporadora],
            ['Piso', record.evaluations.piso],
            ['Painéis', record.evaluations.paineis]
        ];

        doc.autoTable({
            startY: 35,
            head: [['Item de Avaliação', 'Status']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [227, 6, 19] },
            styles: { fontSize: 10 }
        });

        let currentY = doc.lastAutoTable.finalY + 15;

        if (record.observations) {
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(44, 62, 80);
            doc.text('Observações:', 20, currentY);
            doc.setFont("helvetica", "normal");
            const splitObs = doc.splitTextToSize(record.observations, 170);
            doc.text(splitObs, 20, currentY + 7);
            currentY += (splitObs.length * 7) + 15;
        }

        if (record.images && record.images.length > 0) {
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text('Imagens Anexadas:', 20, currentY);
            currentY += 10;

            const margin = 20;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const availableWidth = pageWidth - (2 * margin);
            const gap = 10;
            const imgWidth = (availableWidth - gap) / 2;
            const imgHeightLimit = 60;
            
            let xPos = margin;

            for (let i = 0; i < record.images.length; i++) {
                const imgData = record.images[i];
                
                const imgProps = doc.getImageProperties(imgData);
                const ratio = imgProps.width / imgProps.height;
                
                let displayWidth = imgWidth;
                let displayHeight = displayWidth / ratio;
                
                if (displayHeight > imgHeightLimit) {
                    displayHeight = imgHeightLimit;
                    displayWidth = displayHeight * ratio;
                }

                if (currentY + displayHeight > pageHeight - 20) {
                    doc.addPage();
                    currentY = 20;
                }

                const slotCenterX = xPos + (imgWidth / 2);
                const drawX = slotCenterX - (displayWidth / 2);

                doc.addImage(imgData, 'JPEG', drawX, currentY, displayWidth, displayHeight);
                
                if (xPos === margin) {
                    xPos = margin + imgWidth + gap;
                } else {
                    xPos = margin;
                    currentY += displayHeight + gap;
                }
            }
        }

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
        }
    }

    doc.save(`Relatorio_Inspecao_${loja}_${data}.pdf`);
    
    setTimeout(() => {
        clearAllData();
        showToast('Relatório gerado com sucesso. Sistema preparado para uma nova inspeção.', 'success');
    }, 1500);
}

function clearAllData() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HEADER_STORAGE_KEY);
    
    records = [];
    currentImages = [];
    
    headerForm.reset();
    
    const dateInput = document.getElementById('data');
    dateInput.value = new Date().toISOString().split('T')[0];
    
    renderRecords();
    imagePreview.innerHTML = '';
}
