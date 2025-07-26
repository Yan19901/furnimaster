import ftp from 'basic-ftp';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Загружаем переменные из .env
dotenv.config();

async function copyFilesToDist() {
    console.log('📦 Copying files to dist directory...');
    
    const distDir = './dist';
    
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
    
    // Копируем основные файлы
    for (const file of mainFiles) {
        if (fs.existsSync(file)) {
            fs.copyFileSync(file, path.join(distDir, file));
            console.log(`✅ Copied ${file}`);
        }
    }
    
    // Копируем папки (fonts, images, icons)
    const directories = ['fonts', 'images', 'icons'];
    
    for (const dir of directories) {
        if (fs.existsSync(dir)) {
            copyDirRecursive(dir, path.join(distDir, dir));
            console.log(`✅ Copied directory ${dir}`);
        }
    }
    
    console.log('✅ All files copied to dist successfully!');
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
        await copyFilesToDist();
        
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