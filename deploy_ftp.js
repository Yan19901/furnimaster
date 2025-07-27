import ftp from 'basic-ftp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Загружаем переменные из .env
dotenv.config();

// Создаем кеш файлов для отслеживания изменений
const CACHE_FILE = '.deploy-cache.json';

function getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        }
    } catch (error) {
        console.log('⚠️ Could not load cache file, will rebuild all files');
    }
    return {};
}

function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function isFileChanged(filePath, cache) {
    if (!fs.existsSync(filePath)) return false;
    
    const currentHash = getFileHash(filePath);
    const cachedHash = cache[filePath];
    
    return currentHash !== cachedHash;
}

async function copyFilesToDist() {
    console.log('📦 Checking for file changes and copying to dist directory...');
    
    const distDir = './dist';
    const cache = loadCache();
    const newCache = {};
    let copiedCount = 0;
    
    // Создаем dist директорию если не существует
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Список основных файлов для копирования
    const mainFiles = [
        'index.html',
        'styles.css', 
        'script.js',
        'send-email.php'
    ];
    
    // Копируем основные файлы только если они изменились
    for (const file of mainFiles) {
        if (fs.existsSync(file)) {
            const currentHash = getFileHash(file);
            newCache[file] = currentHash;
            
            if (isFileChanged(file, cache)) {
                fs.copyFileSync(file, path.join(distDir, file));
                console.log(`✅ Copied ${file} (changed)`);
                copiedCount++;
            } else {
                console.log(`⏭️ Skipped ${file} (unchanged)`);
            }
        }
    }
    
    // Копируем папки (fonts, images, icons) с проверкой изменений
    const directories = ['fonts', 'images', 'icons'];
    
    for (const dir of directories) {
        if (fs.existsSync(dir)) {
            const copied = copyDirRecursiveWithCache(dir, path.join(distDir, dir), cache, newCache);
            if (copied > 0) {
                console.log(`✅ Copied directory ${dir} (${copied} files changed)`);
                copiedCount += copied;
            } else {
                console.log(`⏭️ Skipped directory ${dir} (unchanged)`);
            }
        }
    }
    
    // Сохраняем кеш
    saveCache(newCache);
    
    if (copiedCount > 0) {
        console.log(`✅ ${copiedCount} files copied to dist successfully!`);
    } else {
        console.log('ℹ️ No files changed, dist is up to date');
    }
    
    return copiedCount;
}

function copyDirRecursiveWithCache(src, dest, cache, newCache) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    let copiedCount = 0;
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        const relativePath = path.relative('.', srcPath);
        
        if (entry.isDirectory()) {
            copiedCount += copyDirRecursiveWithCache(srcPath, destPath, cache, newCache);
        } else {
            const currentHash = getFileHash(srcPath);
            newCache[relativePath] = currentHash;
            
            if (isFileChanged(relativePath, cache)) {
                fs.copyFileSync(srcPath, destPath);
                copiedCount++;
            }
        }
    }
    
    return copiedCount;
}

function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function deployToFTP() {
    const client = new ftp.Client();
    
    // Показываем прогресс загрузки
    client.ftp.verbose = true;
    
    try {
        console.log('🚀 Starting FTP deployment...');
        
        // Сначала копируем актуальные файлы в dist
        const changedFiles = await copyFilesToDist();
        
        // Если ничего не изменилось, можно пропустить деплой
        if (changedFiles === 0) {
            console.log('ℹ️ No changes detected, skipping FTP upload');
            return;
        }
        
        // Подключение к FTP серверу
        await client.access({
            host: process.env.FTP_HOST,
            port: parseInt(process.env.FTP_PORT) || 21,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: process.env.FTP_SECURE === 'true'
        });
        
        console.log('✅ Connected to FTP server:', process.env.FTP_HOST);
        
        // Определяем локальную папку для загрузки
        const localPath = process.env.FTP_LOCAL_PATH || './dist';
        const remotePath = process.env.FTP_REMOTE_PATH || '/public_html/';
        
        // Проверяем существует ли локальная папка
        if (!fs.existsSync(localPath)) {
            throw new Error(`Local directory ${localPath} does not exist. Did you run build command?`);
        }
        
        console.log(`📁 Uploading from: ${localPath}`);
        console.log(`📁 Uploading to: ${remotePath}`);
        
        // Переходим в удаленную директорию
        await client.ensureDir(remotePath);
        
        // Загружаем файлы
        await client.uploadFromDir(localPath, remotePath);
        
        console.log('🎉 Deployment completed successfully!');
        console.log(`🌐 Your site should be available at: ${process.env.SITE_URL || 'your-website.com'}`);
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
    } finally {
        client.close();
    }
}

// Запускаем деплой
deployToFTP();