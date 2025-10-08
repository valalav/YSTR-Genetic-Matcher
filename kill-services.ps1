# 🔴 Скрипт для завершения всех сервисов DNA-utils-universal

Write-Host "🔍 Поиск и завершение всех связанных процессов..." -ForegroundColor Yellow

# 1. Убиваем процессы на порту 9003 (API сервер)
Write-Host "`n📡 Завершение процессов на порту 9003..." -ForegroundColor Cyan
try {
    $port9003Processes = Get-NetTCPConnection -LocalPort 9003 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
    if ($port9003Processes) {
        foreach ($pid in $port9003Processes) {
            if ($pid -and $pid -ne 0) {
                Write-Host "  🔴 Завершение процесса PID: $pid"
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
    } else {
        Write-Host "  ✅ Порт 9003 свободен"
    }
} catch {
    Write-Host "  ⚠️ Ошибка при проверке порта 9003: $($_.Exception.Message)"
}

# 2. Убиваем процессы на портах 3000-3001 (Next.js)
Write-Host "`n🌐 Завершение процессов на портах 3000-3001..." -ForegroundColor Cyan
foreach ($port in @(3000, 3001)) {
    try {
        $portProcesses = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        if ($portProcesses) {
            foreach ($pid in $portProcesses) {
                if ($pid -and $pid -ne 0) {
                    Write-Host "  🔴 Завершение процесса на порту $port, PID: $pid"
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                }
            }
        } else {
            Write-Host "  ✅ Порт $port свободен"
        }
    } catch {
        Write-Host "  ⚠️ Ошибка при проверке порта $port"
    }
}

# 3. Убиваем все Node.js процессы в директории проекта
Write-Host "`n🟢 Завершение всех Node.js процессов проекта..." -ForegroundColor Cyan
try {
    $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -and $_.Path.Contains("DNA-utils-universal")
    }
    
    if ($nodeProcesses) {
        foreach ($process in $nodeProcesses) {
            Write-Host "  🔴 Завершение Node.js процесса PID: $($process.Id), Path: $($process.Path)"
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "  ✅ Node.js процессы проекта не найдены"
    }
} catch {
    Write-Host "  ⚠️ Ошибка при поиске Node.js процессов: $($_.Exception.Message)"
}

# 4. Убиваем nodemon процессы
Write-Host "`n🔄 Завершение nodemon процессов..." -ForegroundColor Cyan
try {
    $nodemonProcesses = Get-Process | Where-Object { $_.ProcessName -like "*nodemon*" -or $_.MainWindowTitle -like "*nodemon*" }
    if ($nodemonProcesses) {
        foreach ($process in $nodemonProcesses) {
            Write-Host "  🔴 Завершение nodemon процесса PID: $($process.Id)"
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "  ✅ Nodemon процессы не найдены"
    }
} catch {
    Write-Host "  ⚠️ Ошибка при поиске nodemon процессов"
}

# 5. Дополнительная очистка - убиваем все node процессы с высоким использованием памяти
Write-Host "`n🧹 Дополнительная очистка Node.js процессов..." -ForegroundColor Cyan
try {
    $heavyNodeProcesses = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.WorkingSet -gt 50MB }
    if ($heavyNodeProcesses) {
        foreach ($process in $heavyNodeProcesses) {
            Write-Host "  🔴 Завершение тяжелого Node.js процесса PID: $($process.Id), Memory: $([math]::Round($process.WorkingSet/1MB))MB"
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "  ✅ Тяжелые Node.js процессы не найдены"
    }
} catch {
    Write-Host "  ⚠️ Ошибка при поиске тяжелых процессов"
}

# Ждем 2 секунды для завершения процессов
Write-Host "`n⏳ Ожидание завершения процессов..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Финальная проверка портов
Write-Host "`n🔍 Финальная проверка портов..." -ForegroundColor Green
foreach ($port in @(9003, 3000, 3001)) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connections) {
            Write-Host "  ⚠️ Порт $port все еще занят!" -ForegroundColor Red
        } else {
            Write-Host "  ✅ Порт $port свободен" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ✅ Порт $port свободен" -ForegroundColor Green
    }
}

Write-Host "`n🎉 Завершение сервисов завершено! Теперь можно запускать npm run dev" -ForegroundColor Green
Write-Host "Используйте: npm run dev" -ForegroundColor Cyan
