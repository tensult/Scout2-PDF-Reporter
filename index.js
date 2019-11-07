const cli = require('cli');
const ejs = require('ejs');
const fs = require('fs');
const puppeteer = require('puppeteer');

const cliArgs = cli.parse({
    reportPath: ['r', 'Scout2 report path', 'file'],
    output: ['o', 'output file name', 'file', 'scou2-report.pdf']
});

if (!cliArgs.reportPath) {
    cli.getUsage();
}

//Path of Scout report
require(cliArgs.reportPath);

var pdfOptions = {
    format: 'A4',
    "margin": {
        "top": "0.2in", // default is 0, units: mm, cm, in, px 
        "right": "0.2in",
        "bottom": "0.2in",
        "left": "0.2in"
    },
    "header": {
        "height": "20mm"
    },
    "base": `file://${__dirname}/`,
    "footer": {
        "height": "15mm",
        "contents": {
            default: `
        <div class="footer">
          <hr>
          <span class="copyright" style="float: left;">
            Generated using Scout2-PDF-Reporter by Tensult
          </span>
          <span class="pageNumber" style="float: right;">
            {{page}} of {{pages}}
          </span>
        </div>`
        }
    },
};

async function createPDF(html) {
    let browser = null;
    try {
        browser = await puppeteer.launch();;
        const page = await browser.newPage();
        await page.setContent(html);
        return await page.pdf(pdfOptions);
    } catch (error) {
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

function processReportData(reportData) {
    let services = reportData.services;
    for (let serviceName in services) {
        for (let finding in services[serviceName].findings) {
            let findingData = services[serviceName].findings[finding];
            let itemHeaderPath = findingData.display_path ? findingData.display_path : findingData.path;
            let itemHeaderPathValues = itemHeaderPath.split('.');
            reportData.services[serviceName].findings[finding].itemHeader = itemHeaderPathValues.filter(function (elm) {
                return elm !== 'id';
            }).splice(1);
            if (!findingData.items) {
                continue;
            }
            let itemsDetails = findingData.items.map(function (item) {
                let itemValues = item.split('.', itemHeaderPathValues.length);
                let itemDetails = itemValues.reduce(function (obj, val) {
                    obj = obj[val];
                    return obj;
                }, services);
                itemValues.shift();
                let itemValuesForDisplay = itemValues.filter(function (val, index) {
                    return (index % 2 == 1);
                });
                itemDetails.itemValuesForDisplay = itemValuesForDisplay;
                return itemDetails;
            });
            reportData.services[serviceName].findings[finding].itemsDetails = itemsDetails;
        }
    }
    return reportData;
}
let processedReportData = processReportData(aws_info);
ejs.renderFile("report.ejs", processedReportData, {}, function (err, html) {
    if (err) {
        console.error(err);
    }
    fs.writeFileSync('report.html', html, 'utf-8');
    const reportHtmlData = fs.readFileSync('report.html');
    createPDF(reportHtmlData)
        .then(pdfData => fs.writeFileSync('./report.pdf', pdfData))
        .catch(error => console.error(error));

});