#!/bin/bash

# Create downloads directory
mkdir -p downloads

echo "🚀 Downloading CSV files from Google Sheets..."

# Download all CSV files using curl
echo "📥 Downloading AADNA.ru Database..."
curl -L -o "downloads/aadna.csv" "https://docs.google.com/spreadsheets/d/e/2PACX-1vTp8VNm5yS63RiflBpMY4b8d4RBTPecjU_RrC10EDcgSitcQxRtt1QbeN67g8bYOyqB088GLOTHIG5g/pub?gid=90746110&single=true&output=csv"

echo "📥 Downloading G Database..."
curl -L -o "downloads/G.csv" "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOBSOYSNmI7X0vbDNa8qXCloT18ONgs1r9kht_gO62RcMqHuirFZWh-aAl45EOBr_2X-r285ZG4bnf/pub?gid=886727200&single=true&output=csv"

echo "📥 Downloading R1a Database..."
curl -L -o "downloads/r1a.csv" "https://docs.google.com/spreadsheets/d/e/2PACX-1vRU8tnVM0DyHCYmpdQhKAdyjiwc1Q0GYDb1EOBEZu_YPvmEvfQZPSZAsZo2Cvkk3R6qMElcTVKNjNYZ/pub?gid=1094141657&single=true&output=csv"

echo "📥 Downloading J2 Database..."
curl -L -o "downloads/J2.csv" "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdOZKzZjPnAo2WsmK86PymoWNxGm2Dc1kEMGAbtw5kWHPDURgN9e5PRR3x9_ag-CdAntzcSJRddbOS/pub?gid=1964163364&single=true&output=csv"

echo "📥 Downloading J1 Database..."
curl -L -o "downloads/J1.csv" "https://docs.google.com/spreadsheets/d/e/2PACX-1vSf-FRmBHW8hnCopHADt54LApuvyuhpeImR-5xZPRHY_Ca91H8t_uPPgtrN0cIOZHzamN0zjwxV60cX/pub?gid=1814447974&single=true&output=csv"

echo "📥 Downloading E Database..."
curl -L -o "downloads/E.csv" "https://docs.google.com/spreadsheets/d/e/2PACX-1vTvc9oN1jumSux4OBv8MUEzCJyabastzp06C7tuEwv_Ud_DW60ISrVI1D-gKjWs6JibefG8D_pQfIyI/pub?gid=1307961167&single=true&output=csv"

echo "📥 Downloading I Database..."
curl -L -o "downloads/I.csv" "https://docs.google.com/spreadsheets/d/e/2PACX-1vRasrJA3vR1vJineI98GIvmNBL6UXxdpLbJ-k0Qb_60ukvGn9ZDkopG3FDKm0GJg8M8i7r5vK__qsI-/pub?gid=1455355483&single=true&output=csv"

echo "📥 Downloading Others Database..."
curl -L -o "downloads/Others.csv" "https://docs.google.com/spreadsheets/d/e/2PACX-1vSs84tXzDaQzQHjfG4TlR7ARTaE_iU12cgKzjxg7GaQPHRkbisVHRJ8ywx7ldkKV4hyI5pBwYVlYwLz/pub?gid=65836825&single=true&output=csv"

echo "📥 Downloading Genopoisk..."
curl -L -o "downloads/Genopoisk.csv" "https://docs.google.com/spreadsheets/d/e/2PACX-1vQvpu_8LnaCLirvcL1U_HmQZ2dV-sGVtcQ05tI2fmO3Sym-BJ_LE5i9cirzS42vgmWKt21qicEUVRJ2/pub?gid=0&single=true&output=csv"

echo "✅ All CSV files downloaded!"
echo "📊 File sizes:"
ls -lh downloads/*.csv