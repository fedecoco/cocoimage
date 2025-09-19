document.addEventListener('DOMContentLoaded', () => {
    // --- Validación de librerías ---
    // Solo necesitamos HeifEncoder para HEIF. Para los otros formatos, el navegador tiene canvas.toBlob()
    if (typeof HeifEncoder === 'undefined') {
        const errorMessage = 'Error: La librería de HEIF no se cargó correctamente. Revisa tu conexión a internet y la URL del script.';
        console.error(errorMessage);
        alert(errorMessage);
        return;
    }

    // --- Referencias al DOM ---
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const convertBtn = document.getElementById('convert-btn');
    const formatSelect = document.getElementById('format-select');
    const imagePreviews = document.getElementById('image-previews');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const clearBtn = document.getElementById('clear-btn');

    let filesToConvert = [];
    let convertedFiles = [];

    // --- Limpiar archivos ---
    function clearFiles() {
        filesToConvert = [];
        convertedFiles = [];
        imagePreviews.innerHTML = '';
        if (downloadAllBtn) downloadAllBtn.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
        convertBtn.disabled = true;
        fileInput.value = ''; // Resetea el input de archivo
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearFiles);
    }

    // --- Manejo de subida de archivos ---
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('hover');
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('hover');
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('hover');
        handleFiles(e.dataTransfer.files);
    });
    uploadArea.addEventListener('click', (e) => {
        if (e.target.tagName.toLowerCase() !== 'label') fileInput.click();
    });
    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
    });

    function handleFiles(files) {
        filesToConvert = [...files];
        imagePreviews.innerHTML = '';
        convertedFiles = [];
        if (downloadAllBtn) downloadAllBtn.style.display = 'none';
        if (filesToConvert.length > 0) {
            convertBtn.disabled = false;
            if (clearBtn) clearBtn.style.display = 'inline-block';
        } else {
            if (clearBtn) clearBtn.style.display = 'none';
        }

        for (const file of filesToConvert) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.classList.add('preview-item');
                const img = document.createElement('img');
                img.src = e.target.result;
                const fileName = document.createElement('p');
                fileName.classList.add('file-name');
                fileName.textContent = file.name;
                previewItem.appendChild(img);
                previewItem.appendChild(fileName);
                imagePreviews.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        }
    }

    // --- Función genérica para convertir imágenes (excepto HEIF) ---
    // Usando canvas.toBlob() que es nativo del navegador
    async function convertImage(file, format) {
        const imageBitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageBitmap, 0, 0);

        return new Promise((resolve, reject) => { // Agregamos reject para manejar errores
            canvas.toBlob((blob) => {
                if (!blob) {
                    return reject(new Error('Falló la creación del Blob desde el canvas.'));
                }
                const newName = `${file.name.split('.').slice(0, -1).join('.')}.${format}`;
                const convertedFile = new File([blob], newName, { type: `image/${format}` });
                resolve(convertedFile);
            }, `image/${format}`);
        });
    }

    // --- Lógica de conversión ---
    convertBtn.addEventListener('click', async () => {
        const format = formatSelect.value;
        convertedFiles = [];
        const previewItems = imagePreviews.querySelectorAll('.preview-item');

        convertBtn.disabled = true;
        convertBtn.textContent = 'Convirtiendo...';

        for (let i = 0; i < filesToConvert.length; i++) {
            const file = filesToConvert[i];
            const previewItem = previewItems[i];

            // Limpia resultados anteriores
            const existingLink = previewItem.querySelector('a');
            if (existingLink) existingLink.remove();
            const existingError = previewItem.querySelector('p.error-message');
            if (existingError) existingError.remove();

            try {
                let convertedFile;
                const newName = `${file.name.split('.').slice(0, -1).join('.')}.${format}`;

                if (format === 'heif') {
                    // Conversión a HEIF con libheif-js
                    const imageBitmap = await createImageBitmap(file);
                    const canvas = document.createElement('canvas');
                    canvas.width = imageBitmap.width;
                    canvas.height = imageBitmap.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(imageBitmap, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                    // Usamos HeifEncoder directamente, que es lo que expone libheif-bundle.js
                    const encoder = new HeifEncoder(); 
                    const heifArrayBuffer = await encoder.encode(imageData);

                    convertedFile = new File([heifArrayBuffer], newName, { type: 'image/heif' });
                } else {
                    // Conversión con canvas.toBlob para otros formatos
                    convertedFile = await convertImage(file, format);
                }

                convertedFiles.push(convertedFile);

                // Crea y muestra el enlace de descarga
                const downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(convertedFile);
                downloadLink.download = convertedFile.name;
                downloadLink.textContent = 'Descargar';
                downloadLink.classList.add('download-link');
                previewItem.appendChild(downloadLink);

            } catch (error) {
                console.error('Error converting file:', error);
                const errorMsg = document.createElement('p');
                errorMsg.classList.add('error-message');
                // Mensaje de error más específico si la conversión falla
                if (error.message.includes('creation failed') || error.message.includes('toBlob')) {
                    errorMsg.textContent = 'Error: No se pudo crear la imagen convertida.';
                } else if (error.message.includes('not supported') || error.message.includes('HeifEncoder')) {
                    errorMsg.textContent = `Error: El formato ${format.toUpperCase()} no es soportado o la librería no se cargó.`;
                } else {
                    errorMsg.textContent = 'Error al convertir';
                }
                errorMsg.style.color = 'red';
                previewItem.appendChild(errorMsg);
            }
        }

        convertBtn.disabled = false;
        convertBtn.textContent = 'Convertir';

        if (convertedFiles.length > 0 && downloadAllBtn) {
            downloadAllBtn.style.display = 'block';
        }
    });

    // --- Descargar todo ---
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', () => {
            for (const file of convertedFiles) {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(file);
                link.download = file.name;
                link.click();
            }
        });
    }
});