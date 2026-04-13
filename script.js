import exifr from 'https://cdn.jsdelivr.net/npm/exifr@7.1.3/+esm';

const imageInput = document.getElementById('imageInput');
const preview = document.getElementById('preview');
const result = document.getElementById('result');
const verdict = document.getElementById('verdict');
const details = document.getElementById('details');
const labelText = document.getElementById('labelText');

imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Tampilin preview
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
    result.classList.add('hidden');
    labelText.textContent = file.name;

    // Mulai analisis
    const analysis = await analyzeImage(file);
    showResult(analysis);
});

async function analyzeImage(file) {
    let score = 0; // Makin tinggi = makin curiga AI
    let foundDetails = [];

    // 1. Cek ukuran file vs dimensi. AI sering terlalu "bersih" jadi sizenya kecil
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    const mp = img.width * img.height / 1000000;
    const sizeRatio = file.size / 1024 / mp; // KB per MegaPixel

    if (sizeRatio < 50) {
        score += 2;
        foundDetails.push(`<b>Rasio ukuran aneh:</b> ${sizeRatio.toFixed(1)} KB/MP. Gambar AI sering terlalu terkompres.`);
    } else {
        foundDetails.push(`<b>Rasio ukuran:</b> ${sizeRatio.toFixed(1)} KB/MP. Normal untuk foto.`);
    }

    // 2. Cek dimensi aneh. AI suka gen 1024x1024, 512x512
    const commonAISizes = [512, 1024, 1536, 2048];
    if (commonAISizes.includes(img.width) && img.width === img.height) {
        score += 1;
        foundDetails.push(`<b>Dimensi:</b> ${img.width}x${img.height}. Ukuran persegi umum untuk AI generator.`);
    } else {
        foundDetails.push(`<b>Dimensi:</b> ${img.width}x${img.height}.`);
    }

    // 3. Cek metadata EXIF & C2PA
    try {
        const metadata = await exifr.parse(file, { tiff: true, xmp: true, icc: true, iptc: true });

        if (metadata) {
            // Cek C2PA - watermark resmi dari Adobe, DALL·E, dll
            if (JSON.stringify(metadata).includes('c2pa') || JSON.stringify(metadata).includes('claim_generator')) {
                score += 5;
                foundDetails.push(`<b>C2PA Found:</b> Ditemukan watermark C2PA. 99% ini gambar AI dari tools resmi.`);
            }

            // Cek software AI
            const software = metadata.Software || metadata.software || '';
            const aiKeywords = ['dall-e', 'midjourney', 'stable diffusion', 'firefly', 'leonardo'];
            if (aiKeywords.some(keyword => software.toLowerCase().includes(keyword))) {
                score += 5;
                foundDetails.push(`<b>Software:</b> Dibuat dengan ${software}`);
            } else if (software) {
                score -= 1; // Ada software kamera/edit = lebih curiga asli
                foundDetails.push(`<b>Software:</b> ${software}`);
            }

            // Cek data kamera
            if (metadata.Make || metadata.Model) {
                score -= 2;
                foundDetails.push(`<b>Kamera:</b> ${metadata.Make || ''} ${metadata.Model || ''}. Foto asli biasanya ada data kamera.`);
            } else {
                score += 1;
                foundDetails.push(`<b>Kamera:</b> Tidak ada data kamera/EXIF.`);
            }
        } else {
            score += 2;
            foundDetails.push(`<b>Metadata:</b> Kosong total. Gambar AI & hasil screenshot sering hapus semua EXIF.`);
        }
    } catch (e) {
        score += 1;
        foundDetails.push(`<b>Metadata:</b> Gagal dibaca atau korup.`);
    }

    return { score, foundDetails };
}

function showResult({ score, foundDetails }) {
    result.classList.remove('hidden');

    if (score >= 5) {
        verdict.textContent = "Kemungkinan Besar Buatan AI";
        verdict.className = "text-2xl font-bold mb-4 text-red-400";
    } else if (score >= 2) {
        verdict.textContent = "Mencurigakan, Bisa Jadi AI";
        verdict.className = "text-2xl font-bold mb-4 text-yellow-400";
    } else {
        verdict.textContent = "Kemungkinan Besar Asli";
        verdict.className = "text-2xl font-bold mb-4 text-green-400";
    }

    details.innerHTML = foundDetails.map(d => `<p>- ${d}</p>`).join('');
}
