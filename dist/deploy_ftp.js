import ftp from 'basic-ftp';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Загружаем переменные из .env
dotenv.config();

async function syncDistFolder() {
    console.log('📦 Syncing dist folder with latest changes...');
    
    try {
        // Копируем актуальные файлы в dist
        const filesToSync = [
            { src: 'index.html', dest: 'dist/index.html' },
            { src: 'styles.css', dest: 'dist/styles.css' },
            { src: 'script.js', dest: 'dist/script.js' },
            { src: 'send-email.php', dest: 'dist/send-email.php' }
        ];
        
        for (const file of filesToSync) {
            if (fs.existsSync(file.src)) {
                fs.copyFileSync(file.src, file.dest);
                console.log(`✅ Synced: ${file.src} → ${file.dest}`);
            }
        }
        
        // Копируем папки если они существуют
        const foldersToSync = ['fonts', 'images'];
        for (const folder of foldersToSync) {
            if (fs.existsSync(folder)) {
                const destFolder = `dist/${folder}`;
                // Создаем папку если не существует
                if (!fs.existsSync(destFolder)) {
                    fs.mkdirSync(destFolder, { recursive: true });
                }
                
                // Копируем содержимое
                try {
                    execSync(`xcopy "${folder}" "${destFolder}" /E /I /Y`, { stdio: 'pipe' });
                    console.log(`✅ Synced folder: ${folder}`);
                } catch (error) {
                    console.log(`ℹ️  Folder ${folder} sync completed with warnings`);
                }
            }
        }
        
        console.log('✅ Dist folder synchronized successfully!');
        
    } catch (error) {
        console.error('❌ Error syncing dist folder:', error.message);
        throw error;
    }
}

async function deployToFTP() {
    const client = new ftp.Client();
    
    // Показываем прогресс загрузки
    client.ftp.verbose = true;
    
    try {
        // Сначала синхронизируем dist папку
        await syncDistFolder();
        
        console.log('🚀 Starting FTP deployment...');
        
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
deployToFTP().catch(error => {
    console.error('❌ Deployment process failed:', error.message);
    process.exit(1);
});