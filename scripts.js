document.addEventListener('DOMContentLoaded', () => {
    // Valida que AMBAS librerías se hayan cargado correctamente.
    if (typeof IJS === 'undefined' || typeof HeifEncoder === 'undefined') {
        const errorMessage = 'Error: Una o más librerías de imágenes no se cargaron. Revisa tu conexión a internet.';
        console.error(errorMessage);
        alert(errorMessage);
        return;
    }

    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const convertBtn = document.getElementById('convert-btn');
    const formatSelect = document.getElementById('format-select');
    const imagePreviews = document.getElementById('image-previews');
    const downloadAllBtn = document.getElementById('download-all-btn'); 

    let filesToConvert = [];
    let convertedFiles = [];

    // --- El código para manejar la subida de archivos no cambia ---
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('hover'); });
    uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('hover'); });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('hover');
        handleFiles(e.dataTransfer.files);
    });
    uploadArea.addEventListener('click', (e) => { if (e.target.tagName.toLowerCase() !== 'label') fileInput.click(); });
    fileInput.addEventListener('change', () => { handleFiles(fileInput.files); });

    function handleFiles(files) {
        filesToConvert = [...files];
        imagePreviews.innerHTML = '';
        convertedFiles = [];
        if (downloadAllBtn) downloadAllBtn.style.display = 'none';
        if (filesToConvert.length > 0) convertBtn.disabled = false;

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

    // --- LÓGICA DE CONVERSIÓN ACTUALIZADA ---
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

                // --- SELECCIÓN DE LIBRERÍA SEGÚN EL FORMATO ---
                if (format === 'heif') {
                    // --- Ruta 1: Conversión a HEIF con libheif-js ---
                    const imageBitmap = await createImageBitmap(file);
                    const canvas = document.createElement('canvas');
                    canvas.width = imageBitmap.width;
                    canvas.height = imageBitmap.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(imageBitmap, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    const encoder = new HeifEncoder();
                    const heifArrayBuffer = await encoder.encode(imageData);
                    
                    convertedFile = new File([heifArrayBuffer], newName, { type: 'image/heif' });

                } else {
                    // --- Ruta 2: Conversión a formatos estándar con image-js ---
                    const image = await IJS.Image.load(await file.arrayBuffer());
                    const mimeType = `image/${format}`;
                    const blob = await image.toBlob(mimeType);
                    convertedFile = new File([blob], newName, { type: mimeType });
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
                errorMsg.textContent = 'Error al convertir';
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

    // --- El código para descargar todo no cambia ---
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