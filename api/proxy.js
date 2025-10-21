// Alamat API Google Gemini
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=';

// Handler utama untuk Vercel Serverless Function
export default async function handler(request, response) {
    // Hanya izinkan metode POST
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Metode tidak diizinkan' });
    }

    try {
        // Ambil body dari request yang dikirim oleh frontend
        const { action, data } = request.body;

        // Ambil API Key yang sudah disimpan secara rahasia di Environment Variables Vercel
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return response.status(500).json({ error: 'GEMINI_API_KEY tidak diatur di Vercel Environment Variables' });
        }

        // Siapkan prompt dan skema berdasarkan 'action' dari frontend
        let prompt, schema;

        // Definisikan setiap 'action' dan prompt/skema yang sesuai
        switch (action) {
            case 'generateFactors':
                prompt = `Anda adalah seorang konsultan bisnis ahli. Untuk industri "${data.industry || 'bisnis secara umum'}", identifikasi 3-4 faktor penting untuk masing-masing kategori SWOT (Kekuatan, Kelemahan, Peluang, Ancaman).`;
                schema = { type: "OBJECT", properties: { strengths: { type: "ARRAY", items: { type: "STRING" } }, weaknesses: { type: "ARRAY", items: { type: "STRING" } }, opportunities: { type: "ARRAY", items: { type: "STRING" } }, threats: { type: "ARRAY", items: { type: "STRING" } } }, required: ["strengths", "weaknesses", "opportunities", "threats"] };
                break;
            case 'getPairwise':
                prompt = `Anda adalah seorang analis bisnis. Lakukan perbandingan berpasangan untuk ${data.factors.length} faktor berikut: ${data.factors.map((f, i) => `F${i+1} (${f})`).join(', ')}. Untuk setiap pasangan (misal F1 vs F2), tentukan mana yang lebih berpengaruh dan seberapa besar pengaruhnya menggunakan skala ini: [${data.linguisticOptions.join(', ')}].`;
                schema = { type: "OBJECT", properties: { comparisons: { type: "ARRAY", items: { type: "OBJECT", properties: { factor1: { type: "STRING" }, factor2: { type: "STRING" }, dominant_factor: { type: "STRING" }, linguistic_value: { type: "STRING" } }, required: ["factor1", "factor2", "dominant_factor", "linguistic_value"] } } }, required: ["comparisons"] };
                break;
            case 'generateStrategies':
                const { s, w, o, t } = data.factors;
                prompt = `Anda adalah seorang ahli strategi bisnis. Diberikan faktor-faktor SWOT berikut:\nKekuatan: ${s.join('; ')}\nKelemahan: ${w.join('; ')}\nPeluang: ${o.join('; ')}\nAncaman: ${t.join('; ')}\n\nFormulasikan beberapa strategi promosi yang actionable (target 2-3 strategi per jenis jika memungkinkan) untuk setiap kombinasi: SO, ST, WO, dan WT. Pastikan ada setidaknya satu dari setiap jenis.`;
                schema = { type: "OBJECT", properties: { strategies: { type: "ARRAY", items: { type: "OBJECT", properties: { type: { type: "STRING" }, description: { type: "STRING" } }, required: ["type", "description"] } } }, required: ["strategies"] };
                break;
            case 'evaluateStrategies':
                prompt = `Anda adalah seorang analis risiko dan peluang. Untuk setiap strategi berikut:\n${data.strategies.map(s => s.text).join('\n')}\n\nEvaluasi seberapa kuat hubungan (relevansi) setiap strategi terhadap setiap faktor SWOT berikut:\n${data.factors.join('\n')}\n\nBerikan penilaian dari 1 (sangat tidak berhubungan) hingga 5 (sangat berhubungan).`;
                schema = { type: "OBJECT", properties: { evaluations: { type: "ARRAY", items: { type: "OBJECT", properties: { strategy: { type: "STRING" }, ratings: { type: "ARRAY", items: { type: "OBJECT", properties: { factor: { type: "STRING" }, rating: { type: "NUMBER", minimum: 1, maximum: 5 } }, required: ["factor", "rating"] } } }, required: ["strategy", "ratings"] } } }, required: ["evaluations"] };
                break;
            case 'getExplanation':
                prompt = `Strategi promosi berikut ini terpilih sebagai prioritas utama: "${data.topStrategy.text}". Berikan penjelasan singkat (2-3 kalimat) dalam bahasa Indonesia yang meyakinkan mengapa ini adalah langkah strategis terbaik yang harus diambil, mungkin dengan menyinggung kombinasi faktor SWOT yang paling relevan.`;
                schema = { type: "OBJECT", properties: { explanation: { type: "STRING" } }, required: ["explanation"] };
                break;
            default:
                return response.status(400).json({ error: 'Action tidak valid' });
        }

        // Buat payload untuk dikirim ke API Gemini
        const geminiPayload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.5,
            }
        };

        // Kirim request ke API Gemini menggunakan API Key yang aman
        const geminiResponse = await fetch(GEMINI_API_URL + apiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API Error:", errorText);
            throw new Error(`Gemini API merespon dengan status: ${geminiResponse.status}`);
        }

        const geminiResult = await geminiResponse.json();
        const jsonText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) {
            throw new Error("Respons dari Gemini tidak valid atau kosong.");
        }

        const parsedData = JSON.parse(jsonText);

        // Kirim kembali hasil dari Gemini ke frontend
        return response.status(200).json({ data: parsedData });

    } catch (e) {
        console.error("Internal Server Error:", e);
        return response.status(500).json({ error: e.message });
    }
}

