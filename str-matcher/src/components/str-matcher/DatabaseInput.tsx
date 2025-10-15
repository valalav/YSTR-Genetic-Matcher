"use client";

import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent } from '@/components/ui/card';
import { parseCSVData } from '../../utils/csvParser';
import type { STRProfile } from '@/utils/constants';

interface DatabaseInputProps {
  onDataLoaded: (profiles: STRProfile[]) => Promise<void>;
  onDataProcessed: (lastKitNumber?: string) => void;
  onError: (error: string) => void;
  recordCount: number;
}

const DatabaseInput: React.FC<DatabaseInputProps> = ({ onDataLoaded, onDataProcessed, onError, recordCount }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextInput = useCallback(async (text: string) => {
    if (!text.trim()) return;

    try {
      setLoading(true);
      setIsProcessing(true);

      const profiles = await parseCSVData(text);

      // ✅ ИСПРАВЛЕНО: Ждём завершения mergeDatabase
      await onDataLoaded(profiles);

      // Находим последний профиль и передаём его kitNumber
      const lastKitNumber = profiles.length > 0 ? profiles[profiles.length - 1].kitNumber : undefined;

      // Теперь вызываем onDataProcessed с kitNumber последнего профиля
      onDataProcessed(lastKitNumber);

      // Очищаем поле после успешной обработки
      setPasteText('');
      if (textareaRef.current) {
        textareaRef.current.value = '';
      }

      console.log(`✅ Успешно обработано ${profiles.length} профилей, последний: ${lastKitNumber}`);

    } catch (error) {
      console.error('Error parsing CSV data:', error);
      onError(error instanceof Error ? error.message : 'Failed to parse CSV data');
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  }, [onDataLoaded, onDataProcessed, onError]);

  // ✅ НОВЫЙ обработчик события paste
  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData('text');
    
    if (pastedText.trim()) {
      setPasteText(pastedText);
      
      // Обновляем textarea
      if (textareaRef.current) {
        textareaRef.current.value = pastedText;
      }
      
      // Мгновенно обрабатываем вставленные данные
      await handleTextInput(pastedText);
    }
  }, [handleTextInput]);

  // ✅ НОВЫЙ обработчик изменений
  const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    setPasteText(newValue);
    
    // Если данные выглядят как CSV (содержат табы или запятые), обрабатываем
    if (newValue.includes('\t') || newValue.includes(',')) {
      // Дебаунсинг для избежания частых вызовов
      clearTimeout(window.csvProcessingTimeout);
      window.csvProcessingTimeout = setTimeout(() => {
        handleTextInput(newValue);
      }, 500);
    }
  }, [handleTextInput]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const text = await file.text();
      await handleTextInput(text);
    } catch (error) {
      console.error('Error reading file:', error);
      onError(error instanceof Error ? error.message : 'Failed to read file');
    } finally {
      setLoading(false);
      // Очищаем input для возможности повторной загрузки того же файла
      event.target.value = '';
    }
  }, [handleTextInput, onError]);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              className="w-full h-32 p-2 border rounded-md bg-background-primary resize-none"
              placeholder={t('database.pasteOrDrop')}
              value={pasteText}
              onPaste={handlePaste}        // ✅ ДОБАВЛЕНО
              onChange={handleChange}      // ✅ ДОБАВЛЕНО
              onBlur={(e) => {            // ✅ ОСТАВЛЕНО для совместимости
                if (e.target.value.trim() && e.target.value !== pasteText) {
                  handleTextInput(e.target.value);
                }
              }}
              disabled={loading}
            />
            {isProcessing && (
              <div className="mt-2 text-sm text-blue-600 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Processing data...
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="inline-block px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
              {loading ? 'Loading...' : t('database.uploadCSV')}
            </label>
            <div className="text-sm text-text-secondary text-center">
              {loading ? t('database.loadingData') : (
                recordCount > 0 ? t('database.profilesInDatabase', { count: recordCount }) : t('database.databaseEmpty')
              )}
            </div>
          </div>
        </div>
        
        {/* ✅ ДОБАВЛЕНО: Инструкции для пользователя */}
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          💡 <strong>How to use:</strong>
          <ul className="mt-1 ml-4 list-disc">
            <li>Copy table from Excel or browser (Ctrl+C)</li>
            <li>Paste into field above (Ctrl+V) - data will be processed automatically</li>
            <li>Or upload CSV file via "Upload CSV" button</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default DatabaseInput;