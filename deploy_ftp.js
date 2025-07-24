import ftp from 'basic-ftp';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Загружаем переменные из .env
dotenv.config();

async function deployToFTP() {
    const client = new ftp.Client();
    
    // Показываем прогресс загрузки
    client.ftp.verbose = true;
    
    try {
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
deployToFTP();