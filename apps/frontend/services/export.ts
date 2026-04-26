import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const exportPredictionToPDF = async (prediction: any) => {
  try {
    // Generate the current date for the report
    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // 1. Build the HTML Template
    // Using inline CSS to ensure the PDF generator styles it perfectly
    const htmlContent = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #111827; }
            .header { border-bottom: 2px solid #2563EB; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 28px; font-weight: bold; color: #0F172A; margin: 0 0 10px 0; }
            .subtitle { font-size: 14px; color: #6B7280; text-transform: uppercase; }
            
            .grid { display: flex; flex-direction: row; margin-bottom: 30px; }
            .column { flex: 1; }
            .label { font-size: 12px; color: #6B7280; text-transform: uppercase; margin-bottom: 4px; font-weight: bold; }
            .value { font-size: 16px; font-weight: 500; color: #111827; margin-bottom: 16px; }
            
            .result-box { background-color: ${prediction.outcome === 'Success' ? '#ECFDF5' : '#FEF2F2'}; border: 1px solid ${prediction.outcome === 'Success' ? '#10B981' : '#EF4444'}; padding: 20px; border-radius: 12px; margin-bottom: 40px; text-align: center; }
            .result-title { font-size: 24px; font-weight: bold; color: ${prediction.outcome === 'Success' ? '#065F46' : '#991B1B'}; margin: 0 0 8px 0; }
            .result-score { font-size: 18px; color: #374151; margin: 0; }
            
            .image-section { text-align: center; margin-top: 20px; page-break-inside: avoid; }
            .evidence-img { max-width: 100%; height: auto; max-height: 400px; border-radius: 8px; border: 1px solid #E5E7EB; }
            .img-caption { margin-top: 10px; font-size: 14px; color: #6B7280; font-style: italic; }
            
            .footer { margin-top: 50px; font-size: 10px; color: #9CA3AF; text-align: center; border-top: 1px solid #E5E7EB; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">CardioPredict Analysis Report</h1>
            <div class="subtitle">Generated on ${reportDate}</div>
          </div>

          <div class="grid">
            <div class="column">
              <div class="label">Project ID</div>
              <div class="value">${prediction.project_id || 'N/A'}</div>
              
              <div class="label">Batch ID</div>
              <div class="value">${prediction.batch_id}</div>
            </div>
            <div class="column">
              <div class="label">Cell Line</div>
              <div class="value">${prediction.cell_line}</div>
              
              <div class="label">Database Record ID</div>
              <div class="value">#${prediction.id}</div>
            </div>
          </div>

          <div class="result-box">
            <h2 class="result-title">Outcome: ${prediction.outcome.toUpperCase()}</h2>
            <p class="result-score">Model Confidence (Z-Disk Probability): <strong>${prediction.confidence}%</strong></p>
          </div>

          <div class="image-section">
            <div class="label">Analysis Heatmap (Visual Evidence)</div>
            ${prediction.heatmap_url 
                ? `<img src="${prediction.heatmap_url}" class="evidence-img" />` 
                : `<div style="padding: 40px; background: #F3F4F6; color: #9CA3AF;">Image data unavailable</div>`
            }
            <div class="img-caption">GradCAM overlay isolating morphological features driving the inference.</div>
          </div>

          <div class="footer">
            Report generated via CardioPredict Mobile App.<br/>
            Original S3 Path: ${prediction.original_image_s3_key}
          </div>
        </body>
      </html>
    `;

    // 2. Convert HTML to a temporary PDF file on the device
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false
    });

    // 3. Open the native iOS/Android Share Sheet
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Export Batch ${prediction.batch_id} to Lab Notebook`,
        UTI: 'com.adobe.pdf' // Specific for iOS to know it's a PDF
      });
    } else {
      throw new Error("Sharing is not available on this device");
    }

  } catch (error) {
    console.error("Failed to generate PDF:", error);
    throw error;
  }
};