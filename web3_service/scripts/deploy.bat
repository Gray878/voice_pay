@echo off
setlocal

REM Go to web3_service root (parent of scripts)
cd /d "%~dp0.."

echo ========================================
echo OrderBook Contract Deployment Script
echo ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

REM Check .env
if not exist ".env" (
    echo [WARNING] .env not found. Copying from .env.example...
    if exist ".env.example" (
        copy .env.example .env
        echo [INFO] .env created.
    ) else (
        echo [ERROR] .env.example not found.
        pause
        exit /b 1
    )
    echo [INFO] Edit .env and set PRIVATE_KEY or WHIMLAND_PRIVATE_KEY
    echo        Optional: POLYGON_AMOY_RPC_URL
    pause
)

REM Step 1 - dependencies
if not exist "node_modules" (
    echo [Step 1/3] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed.
) else (
    echo [Step 1/3] Dependencies OK, skipping.
)

REM Step 2 - compile
echo.
echo [Step 2/3] Compiling contracts...
call npx hardhat compile
if errorlevel 1 (
    echo [ERROR] Compile failed.
    pause
    exit /b 1
)
echo [SUCCESS] Compile done.

REM Check deployer key in .env
node -e "require('dotenv').config({path:'.env'}); var k=process.env.PRIVATE_KEY||process.env.WHIMLAND_PRIVATE_KEY||process.env.WEB3_SERVICE_PRIVATE_KEY; if(!k||!k.trim()){console.error('[ERROR] Set PRIVATE_KEY or WHIMLAND_PRIVATE_KEY in .env'); process.exit(1);}"
if errorlevel 1 (
    pause
    exit /b 1
)

REM Step 3 - deploy (Polygon Amoy; use full path to script)
echo.
echo [Step 3/3] Deploying to Polygon Amoy...
call npx hardhat run "%~dp0deploy.js" --network polygon-amoy --show-stack-traces
if errorlevel 1 (
    echo.
    echo [ERROR] Deploy failed.
    echo 1. Set PRIVATE_KEY or WHIMLAND_PRIVATE_KEY in web3_service\.env
    echo 2. Get test MATIC: https://faucet.polygon.technology/ - select Amoy
    echo 3. Optional: set POLYGON_AMOY_RPC_URL or EVM_RPC_URL in .env
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Deployment Complete
echo ========================================
echo Output: deployments/polygon-amoy.json
echo .env updated with ORDERBOOK_ADDRESS and USDOL_ADDRESS
echo.
echo Next: npm run verify  or  node scripts/verify-deployment.js
pause
