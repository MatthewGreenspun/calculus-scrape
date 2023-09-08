import * as path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";
import puppeteer from "puppeteer";
import { config } from "dotenv";
config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAIN_PAGE = "https://app.schoology.com/course/6268682396/materials";
const INTRODUCTION =
  "https://app.schoology.com/course/6268682396/materials?f=640387367";
const LIMITS =
  "https://app.schoology.com/course/6268682396/materials?f=640387935";
const DIFFERENTIATION =
  "https://app.schoology.com/course/6268682396/materials?f=640387963";
const INTEGRATION =
  "https://app.schoology.com/course/6268682396/materials?f=640388011";
const SERIES =
  "https://app.schoology.com/course/6268682396/materials?f=640388122";
const VECTOR_POLAR =
  "https://app.schoology.com/course/6268682396/materials?f=640388145";
const REVIEW =
  "https://app.schoology.com/course/6268682396/materials?f=640388156";
const POST_AP =
  "https://app.schoology.com/course/6268682396/materials?f=640388190";

const units = [
  { name: "introduction", link: INTRODUCTION },
  { name: "limits", link: LIMITS },
  { name: "differentiation", link: DIFFERENTIATION },
  { name: "integration", link: INTEGRATION },
  { name: "series", link: SERIES },
  { name: "vector_polar", link: VECTOR_POLAR },
  { name: "review", link: REVIEW },
  { name: "postAP", link: POST_AP },
];

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();

await page.goto("https://app.schoology.com/login");
await page.setViewport({ width: 1080, height: 1024 });
await page.type("#edit-mail", process.env.SCHOOLOGY_EMAIL!);
await page.type("#edit-pass", process.env.SCHOOLOGY_PASSWORD!);

const loginButton = "#edit-submit";
await page.waitForSelector(loginButton);
await page.click(loginButton);
await page.goto(MAIN_PAGE);

for (const unit of units) {
  await page.goto(unit.link);
  const homeworkLinks = await page.$$eval(
    ".item-title > a",
    (elements: HTMLAnchorElement[]) => {
      return elements.reduce<string[]>(
        (prev, curr) =>
          curr.innerText.substring(0, 2) == "HW" ? [curr.href, ...prev] : prev,
        []
      );
    }
  );
  for (const link of homeworkLinks) {
    try {
      await page.goto(link);
      const [pageTitle, html] = await Promise.all([
        page.$eval(".page-title", (element) => element.innerHTML),
        page.$eval(".info-body", (element) => element.innerHTML),
      ]);
      const folder = path.join(
        __dirname,
        "../content",
        `${unit.name}/${pageTitle.replaceAll(" ", "_")}`
      );
      if (fs.existsSync(folder)) continue;
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, "assignment.html"), html);
      const client = await page.target().createCDPSession();
      await client.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: path.join(folder, "attachments"),
      });
      const urls = await page.$$eval(
        ".attachments-file-name > a:nth-child(1)",
        (elements) =>
          elements.map((element) => [element.innerText, element.href])
      );
      const attachmentsFolder = path.join(folder, "attachments");
      if (!fs.existsSync(attachmentsFolder)) {
        fs.mkdirSync(attachmentsFolder, { recursive: true });
      }
      for (const url of urls) {
        try {
          await page.goto(url[1]);
          await page.pdf({ path: path.join(attachmentsFolder, url[0]) });
          await page.goBack();
        } catch (err) {
          // this errors a bunch but it still works
        }
      }
      await page.goBack();
    } catch (err) {
      console.error(err);
    }
  }
}

setTimeout(() => browser.close(), 2000);
