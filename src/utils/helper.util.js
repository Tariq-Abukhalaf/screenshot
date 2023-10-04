const puppeteerSingleton                               = require('../utils/puppeteerSingleton.class');
const { PutObjectCommand, S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl }                                 = require("@aws-sdk/s3-request-presigner");
const axios                                            = require('axios');
const path                                             = require('path');
const sharp                                            = require('sharp');
const fs                                               = require('fs').promises;
require('dotenv').config();

async function resizeImage(path,width,height) {
  try {
    const image = await fs.readFile(path);
    return await sharp(image).resize(width,height).toBuffer();
  } catch (err) {
    console.error('Error resizing image:', err);
  }
}

async function scaleImage(path,width,height) {
  try {
    const image        = await fs.readFile(path);
    const {data, info} = await sharp(image).resize({
      width: width,
      height: height,
      fit: 'inside',
    }).toBuffer({ resolveWithObject: true });
    return {
      buffer:data,
      info:info
    };
  } catch (err) {
    console.error('Error scaleImage image:', err);
  }
}

async function crop(path,width,height)
{
  /**
   * always start from left top corner
   */
  try {
    const left   = 0;
    const top    = 0;
    const image    = await fs.readFile(path);
    const metadata = await sharp(image).metadata();
    if (width > metadata.width){ width = metadata.width; }
    if (height > metadata.height){ height = metadata.height; }
    return await sharp(image).extract({ left, top, width, height }).toBuffer();
  }catch (err) {
    console.error('Error crop image:', err);
  }
}

async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (err) {
    console.error(`Error deleting file ${filePath}: ${err}`);
    return false;
  }
}

async function takeScreenshot(url,width,height)
{
  const pSingleton = new puppeteerSingleton();
  const page = await pSingleton.createNewTab();
  await page.goto(url,{ waitUntil: 'networkidle0' });
  const screenshotPath = path.join('src/screenshots', `screenshot_${Date.now()}.png`);
  await page.screenshot({ path:screenshotPath, fullPage: true });
  const scaleImageObj = await scaleImage(screenshotPath,width,height);
  if (!scaleImageObj.buffer){
    return false;
  }
  await pSingleton.closeTab(page);
  await deleteFile(screenshotPath);
  return scaleImageObj;
}

async function uploadScreenshot(screenshot)
{
  const client = new S3Client({
    region: process.env.AWS_REGION,
    credentials:{ 
      accessKeyId: process.env.AWS_ACCESS_KEY, 
      secretAccessKey:  process.env.AWS_SECRET_KEY 
    },
  });
  const params = {
    Bucket          : process.env.AWS_BUCKET,
    Key             : `screenshot_${Date.now()}.jpg`,
    Body            : screenshot,
    ACL             : 'public-read',
    ContentEncoding : 'base64',
    ContentType     : 'image/png',
  };
  const command  = new PutObjectCommand(params);
  const response = await client.send(command);
  return await getSignedUrl(client, new GetObjectCommand(params), { expiresIn: 24 * 60 * 60 }); // 24 hour
}

async function triggerURL(url) {
  try{
    const config = {
      method: 'get',
      url: url,
      timeout: 10000, // wait for 10s then timeout
      headers: { 
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json',
      },
    }
    const response = await axios(config)
    return response.status;
  }catch(e){
    return false;
  }
}

function isValidHttpUrl(str) {
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
    '(\\#[-a-z\\d_]*)?$', // fragment locator
    'i'
  );
  return pattern.test(str);
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
}

function isPositive(num) {
  if (typeof num === 'number' && Math.sign(num) === 1) {
    return true;
  }
  return false;
}

function isNegative(num) {
  if (typeof num === 'number' && Math.sign(num) === -1) {
    return true;
  }
  return false;
}

module.exports = {
  isValidHttpUrl,
  takeScreenshot,
  uploadScreenshot,
  triggerURL,
  formatFileSize,
  isPositive,
  isNegative,
}
