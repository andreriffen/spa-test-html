#!/usr/bin/env python3
"""
Test runner using Playwright to render `analiseContratual.html` locally and extract result values.

Usage: python3 tests/playwright_run.py

O script tenta instalar o Playwright automaticamente caso não esteja presente.
"""
import csv
import json
import os
import random
import subprocess
import sys
from urllib.parse import urlencode

ROOT = os.path.dirname(os.path.dirname(__file__))
OUT_JSON = os.path.join(ROOT, 'tests', 'results.json')
OUT_CSV = os.path.join(ROOT, 'tests', 'results.csv')

URL_BASE = os.environ.get('TEST_URL_BASE', 'http://127.0.0.1:8080/analiseContratual.html')

IDS = [
    'valorTotalPago', 'valorDividaRestante', 'percentualPago', 'valorAtraso', 'valorEncargosAtraso',
    'parcelasRestantes', 'valorTotalFinanciamento', 'saldoBancoResultado', 'valorBemBase', 'valorBemAtual',
    'percentualDepreciacao', 'gapSaldoValorBem', 'exposicaoCliente', 'cenario1Desconto', 'cenario2Desconto'
]


def ensure_playwright():
    try:
        import playwright  # noqa: F401
        return
    except Exception:
        print('Playwright not found — installing via pip...')
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'playwright>=1.40.0'])
        print('Installing browser binaries (playwright install chromium)...')
        subprocess.check_call([sys.executable, '-m', 'playwright', 'install', 'chromium'])


def brl_to_float(s: str):
    if not s:
        return None
    s = s.strip()
    # remove HTML nbsp
    s = s.replace('\xa0', '').replace('\u00a0', '')
    # If percentage
    if s.endswith('%'):
        try:
            return float(s.strip().replace('%', '').replace(',', '.'))
        except Exception:
            return None
    # Remove currency symbol
    s = s.replace('R$', '').replace('R', '')
    s = s.replace(' ', '')
    # thousand separator: '.'; decimal: ',' --> convert to float
    s = s.replace('.', '').replace(',', '.')
    try:
        return float(s)
    except Exception:
        return None


def generate_cases(n=20, seed=12345):
    random.seed(seed)
    cases = []
    for _ in range(n):
        valorBem = random.choice([20000, 35000, 50000, 75000, 95000, 120000])
        saldoBanco = random.choice([valorBem + 20000, valorBem + 30000, valorBem - 10000, 120000, 60000])
        totalParcelas = random.choice([36, 48, 60, 72])
        valorParcela = random.choice([500, 650, 850, 1200])
        parcelasPagas = random.randint(0, int(totalParcelas * 0.8))
        parcelasAtraso = random.choice([0, 1, 3, 6, 12])
        valorEntrada = random.choice([0, 2000, 5000])
        teveEntrada = 'true' if valorEntrada > 0 else 'false'

        params = {
            'nomeCliente': 'Joao',
            'nomeConsultor': 'Maria',
            'valorBem': str(valorBem),
            'anoVeiculo': '2021',
            'saldoBanco': str(saldoBanco),
            'totalParcelas': str(totalParcelas),
            'parcelasPagas': str(parcelasPagas),
            'valorParcela': str(valorParcela),
            'parcelasAtraso': str(parcelasAtraso),
            'valorEntrada': str(valorEntrada),
            'teveEntrada': teveEntrada,
            'tipoFinanciamento': 'veiculo'
        }
        cases.append(params)
    return cases


def run_tests(cases):
    ensure_playwright()
    from playwright.sync_api import sync_playwright

    results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        for i, params in enumerate(cases, start=1):
            url = URL_BASE + '?' + urlencode(params)
            print(f'[{i}/{len(cases)}] Loading: {url}')
            page.goto(url, wait_until='networkidle')
            # small wait to let frontend update
            page.wait_for_timeout(250)

            extracted = {}
            for id in IDS:
                try:
                    el = page.locator(f'#{id}')
                    text = el.text_content(timeout=1000)
                    extracted[id] = text.strip() if text is not None else None
                except Exception:
                    extracted[id] = None

            # basic checks
            alerts = []
            valorTotalFinanciamento_raw = extracted.get('valorTotalFinanciamento')
            vtf = brl_to_float(valorTotalFinanciamento_raw)
            expected_vtf = None
            try:
                expected_vtf = int(params['totalParcelas']) * float(params['valorParcela'])
            except Exception:
                expected_vtf = None

            if expected_vtf is not None and vtf is not None:
                if abs(vtf - expected_vtf) > 0.5:
                    alerts.append(f"valorTotalFinanciamento mismatch: expected {expected_vtf} got {vtf}")

            # saldoBanco check
            saldo_raw = extracted.get('saldoBancoResultado')
            saldo_val = brl_to_float(saldo_raw)
            try:
                expected_saldo = float(params['saldoBanco'])
            except Exception:
                expected_saldo = None
            if expected_saldo is not None and saldo_val is not None:
                if abs(saldo_val - expected_saldo) > 0.5:
                    alerts.append(f"saldoBanco mismatch: expected {expected_saldo} got {saldo_val}")

            results.append({
                'case_index': i,
                'params': params,
                'extracted': extracted,
                'alerts': alerts,
            })

        browser.close()

    # write outputs
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # CSV summary
    with open(OUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        header = ['case_index', 'valorBem', 'saldoBanco', 'totalParcelas', 'valorParcela', 'parcelasPagas', 'valorTotalFinanciamento', 'extracted_valorTotalFinanciamento', 'saldoBancoResultado', 'alerts']
        writer.writerow(header)
        for r in results:
            p = r['params']
            e = r['extracted']
            writer.writerow([
                r['case_index'], p.get('valorBem'), p.get('saldoBanco'), p.get('totalParcelas'), p.get('valorParcela'), p.get('parcelasPagas'),
                (int(p.get('totalParcelas')) * float(p.get('valorParcela'))) if p.get('totalParcelas') and p.get('valorParcela') else '',
                e.get('valorTotalFinanciamento'), e.get('saldoBancoResultado'), '; '.join(r['alerts'])
            ])

    print('\nDone. Results written to:', OUT_JSON, 'and', OUT_CSV)


if __name__ == '__main__':
    CASES = generate_cases(20)
    run_tests(CASES)
