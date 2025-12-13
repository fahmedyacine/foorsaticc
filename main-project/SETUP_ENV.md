# Setting Environment Variables

This guide shows how to set the required environment variables for the application.

## Required Variables

- `MISTRAL_API_KEY` - For document processing
- `DEEPSEEK_API_KEY` - For chatbot functionality

## Quick Setup (Windows)

### Option 1: Using the provided scripts

**For Command Prompt:**
```cmd
set_env_variables.bat
```

**For PowerShell:**
```powershell
.\set_env_variables.ps1
```

### Option 2: Manual Setup

#### Windows Command Prompt (CMD)

**For current session only:**
```cmd
set MISTRAL_API_KEY=97ZQlsV45YrDusgZRwjArWGbh3nerFPb
set DEEPSEEK_API_KEY=9UTzYmpmp7VfXRf_Bnyfne9jNFmpnY2I9nr2GWax705uDZLqFkrG3tM3Imu3pJ8jcqit-DOPjVglO61N7y1O3Q
```

**Permanently (requires new terminal):**
```cmd
setx MISTRAL_API_KEY "97ZQlsV45YrDusgZRwjArWGbh3nerFPb"
setx DEEPSEEK_API_KEY "9UTzYmpmp7VfXRf_Bnyfne9jNFmpnY2I9nr2GWax705uDZLqFkrG3tM3Imu3pJ8jcqit-DOPjVglO61N7y1O3Q"
```

#### Windows PowerShell

**For current session:**
```powershell
$env:MISTRAL_API_KEY = "97ZQlsV45YrDusgZRwjArWGbh3nerFPb"
$env:DEEPSEEK_API_KEY = "9UTzYmpmp7VfXRf_Bnyfne9jNFmpnY2I9nr2GWax705uDZLqFkrG3tM3Imu3pJ8jcqit-DOPjVglO61N7y1O3Q"
```

**Permanently:**
```powershell
[System.Environment]::SetEnvironmentVariable("MISTRAL_API_KEY", "97ZQlsV45YrDusgZRwjArWGbh3nerFPb", "User")
[System.Environment]::SetEnvironmentVariable("DEEPSEEK_API_KEY", "9UTzYmpmp7VfXRf_Bnyfne9jNFmpnY2I9nr2GWax705uDZLqFkrG3tM3Imu3pJ8jcqit-DOPjVglO61N7y1O3Q", "User")
```

#### Windows GUI

1. Open System Properties:
   - Press `Win + R`, type `sysdm.cpl`, press Enter
   - OR: Right-click "This PC" → Properties → Advanced system settings

2. Click "Environment Variables"

3. Under "User variables", click "New"

4. Add each variable:
   - Variable name: `MISTRAL_API_KEY`
   - Variable value: `97ZQlsV45YrDusgZRwjArWGbh3nerFPb`
   
   - Variable name: `DEEPSEEK_API_KEY`
   - Variable value: `9UTzYmpmp7VfXRf_Bnyfne9jNFmpnY2I9nr2GWax705uDZLqFkrG3tM3Imu3pJ8jcqit-DOPjVglO61N7y1O3Q`

5. Click OK to save

## Linux/Mac

```bash
export MISTRAL_API_KEY="97ZQlsV45YrDusgZRwjArWGbh3nerFPb"
export DEEPSEEK_API_KEY="9UTzYmpmp7VfXRf_Bnyfne9jNFmpnY2I9nr2GWax705uDZLqFkrG3tM3Imu3pJ8jcqit-DOPjVglO61N7y1O3Q"
```

To make permanent, add to `~/.bashrc` or `~/.zshrc`:
```bash
echo 'export MISTRAL_API_KEY="97ZQlsV45YrDusgZRwjArWGbh3nerFPb"' >> ~/.bashrc
echo 'export DEEPSEEK_API_KEY="9UTzYmpmp7VfXRf_Bnyfne9jNFmpnY2I9nr2GWax705uDZLqFkrG3tM3Imu3pJ8jcqit-DOPjVglO61N7y1O3Q"' >> ~/.bashrc
source ~/.bashrc
```

## Verify Variables Are Set

**Windows CMD:**
```cmd
echo %MISTRAL_API_KEY%
echo %DEEPSEEK_API_KEY%
```

**Windows PowerShell:**
```powershell
$env:MISTRAL_API_KEY
$env:DEEPSEEK_API_KEY
```

**Linux/Mac:**
```bash
echo $MISTRAL_API_KEY
echo $DEEPSEEK_API_KEY
```

## Important Notes

- After setting environment variables permanently, you may need to **restart your terminal/IDE** for changes to take effect
- For current session only: Variables are available immediately but will be lost when you close the terminal
- For permanent: Variables persist across terminal sessions but require a restart to be available in already-running processes

