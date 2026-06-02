import sys

def search_missing():
    with open('frontend/app.js', 'r') as f:
        lines = f.readlines()
    
    missing = ['cargarInventarioGlobal', 'setupInventoryPage', 'setupUserPage']
    found = {m: False for m in missing}
    
    for i, line in enumerate(lines):
        for m in missing:
            if f'function {m}' in line or f'async function {m}' in line or f'{m} =' in line:
                if '(' in line:
                    print(f"Found {m} at line {i+1}: {line.strip()}")
                    found[m] = True
    
    for m, status in found.items():
        if not status:
            print(f"NOT FOUND: {m}")

if __name__ == "__main__":
    search_missing()
