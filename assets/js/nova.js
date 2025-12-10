/* Javascript somente para `analiseContratual.html`, não para outras partes do site institucional. Arquivo inteiramente dedicado a essa página. */

const MULTA_ATRASO_PERCENTUAL = 0.02;
const JUROS_MENSAL_ATRASO = 0.01;

function preencherCamposComURL() {
    const params = new URLSearchParams(window.location.search);

    if (params.has('nomeCliente')) document.getElementById('nomeCliente').value = params.get('nomeCliente');
    if (params.has('nomeConsultor')) document.getElementById('nomeConsultor').value = params.get('nomeConsultor');
    if (params.has('valorBem')) document.getElementById('valorBem').value = params.get('valorBem');
    if (params.has('anoVeiculo')) document.getElementById('anoVeiculo').value = params.get('anoVeiculo');
    if (params.has('saldoBanco')) document.getElementById('saldoBanco').value = params.get('saldoBanco');
    if (params.has('totalParcelas')) document.getElementById('totalParcelas').value = params.get('totalParcelas');
    if (params.has('parcelasPagas')) document.getElementById('parcelasPagas').value = params.get('parcelasPagas');
    if (params.has('valorParcela')) document.getElementById('valorParcela').value = params.get('valorParcela');
    if (params.has('parcelasAtraso')) document.getElementById('parcelasAtraso').value = params.get('parcelasAtraso');
    if (params.has('valorEntrada')) document.getElementById('valorEntrada').value = params.get('valorEntrada');
    if (params.get('teveEntrada') === 'true') document.getElementById('teveEntrada').checked = true;
    if (params.has('tipoFinanciamento')) document.getElementById('tipoFinanciamento').value = params.get('tipoFinanciamento');
}

window.onload = function () {
    preencherCamposComURL();

    // Se quiser que a análise rode automaticamente ao abrir a página com os parâmetros:
    if (window.location.search) {
        calcularAnalise();
    }
};

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function readNumber(raw) {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return isFinite(raw) ? raw : 0;
    const s = String(raw).trim();
    if (s === '') return 0;
    // remove common formatting: currency symbol, spaces and thousand separators
    const cleaned = s.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(/,/g, '.');
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
}

function estimarDepreciacao(valorBem, anoVeiculo) {
    if (!valorBem || valorBem <= 0) {
        return {
            valorAtual: 0,
            percentual: 0,
            fatorAplicado: 0
        };
    }

    const anoAtual = new Date().getFullYear();
    const idadeVeiculo = anoVeiculo ? Math.max(0, anoAtual - anoVeiculo) : 0;

    const depreciacaoAnual = Math.min(idadeVeiculo * 0.07, 0.5); // até 50%
    const fatorTotal = Math.min(depreciacaoAnual, 0.7);
    const valorAtual = valorBem * (1 - fatorTotal);

    return {
        valorAtual,
        percentual: fatorTotal * 100,
        fatorAplicado: fatorTotal
    };
}

function definirPercentuaisDesconto(percentualPago, diferencaSaldoValorBem, parcelasAtraso) {
    let conservador = 0.5;
    let agressivo = 0.8;

    if (percentualPago >= 70) {
        conservador = 0.6;
        agressivo = 0.85;
    } else if (percentualPago >= 50) {
        conservador = 0.55;
        agressivo = 0.82;
    } else if (percentualPago >= 30) {
        conservador = 0.5;
        agressivo = 0.78;
    } else {
        conservador = 0.4;
        agressivo = 0.7;
    }

    if (diferencaSaldoValorBem > 20000) {
        conservador += 0.05;
        agressivo += 0.05;
    } else if (diferencaSaldoValorBem < -10000) {
        conservador -= 0.05;
        agressivo -= 0.05;
    }

    if (parcelasAtraso >= 6) {
        conservador -= 0.05;
    }
    if (parcelasAtraso >= 12) {
        agressivo -= 0.05;
    }

    conservador = Math.min(Math.max(conservador, 0.25), 0.75);
    agressivo = Math.min(Math.max(agressivo, conservador + 0.05), 0.9);

    return { conservador, agressivo };
}

function ajustarPercentualAcordo(valor, minimo, maximo) {
    const limitado = Math.min(Math.max(valor, minimo), maximo);
    const passos = Math.floor(limitado / 0.05) * 0.05;
    return parseFloat(passos.toFixed(2));
}

function gerarInsightsJuridicos(contexto) {
    const insights = [];

    if (contexto.percentualPago >= 70) {
        insights.push({
            icon: 'bi-check2-circle',
            titulo: 'Adimplemento substancial',
            descricao: `${contexto.percentualPago.toFixed(1)}% do contrato já foi quitado, permitindo reivindicar tratamento de adimplente substancial e limitar a retomada do bem.`
        });
    } else if (contexto.percentualPago >= 50) {
        insights.push({
            icon: 'bi-graph-up',
            titulo: 'Pagamentos relevantes',
            descricao: `${contexto.percentualPago.toFixed(1)}% já amortizado reforça o argumento de onerosidade para novas cobranças integrais.`
        });
    }

    if (contexto.temValorBem && contexto.diferencaSaldoValorBem > 0) {
        insights.push({
            icon: 'bi-exclamation-octagon',
            titulo: 'Saldo maior que o bem',
            descricao: `O banco cobra ${formatarMoeda(contexto.saldoBanco)} para um bem estimado em ${formatarMoeda(contexto.valorBemComparativo)}, diferença de ${formatarMoeda(contexto.diferencaSaldoValorBem)} que caracteriza cobrança desproporcional.`
        });
    }

    if (contexto.valorEncargosAtraso > 0) {
        insights.push({
            icon: 'bi-receipt',
            titulo: 'Encargos inflacionados',
            descricao: `Encargos projetados em ${formatarMoeda(contexto.valorEncargosAtraso)} permitem contestar juros/multas abusivas antes de fechar o acordo.`
        });
    }

    if (contexto.exposicaoRealCliente > 0) {
        insights.push({
            icon: 'bi-shield-lock',
            titulo: 'Proteção ao cliente',
            descricao: `Mesmo após pagar ${formatarMoeda(contexto.valorTotalPago)}, o cliente segue exposto em ${formatarMoeda(contexto.exposicaoRealCliente)}, sustentando pedido de redução imediata.`
        });
    }

    if (contexto.parcelasAtraso >= 3 && contexto.tipoFinanciamento === 'veiculo') {
        insights.push({
            icon: 'bi-truck',
            titulo: 'Bem essencial ao trabalho',
            descricao: `Parcelas em atraso resultam de uso contínuo do veículo; negociamos manutenção da posse enquanto revisamos o saldo.`
        });
    }

    if (!insights.length) {
        insights.push({
            icon: 'bi-lightbulb',
            titulo: 'Espaço para negociação',
            descricao: 'Os dados confirmam margem para acordo rápido com redução expressiva e eliminação dos encargos futuros.'
        });
    }

    return insights.slice(0, 3);
}

function atualizarFundamentacaoDinamica(insights) {
    const wrapper = document.getElementById('fundamentacaoDinamicaWrapper');
    const container = document.getElementById('fundamentacaoDinamica');

    if (!wrapper || !container) {
        return;
    }

    if (!insights.length) {
        container.innerHTML = '';
        wrapper.classList.add('hidden');
        return;
    }

    const html = insights.map(item => `
        <div class="storyline-step">
            <h4><i class="bi ${item.icon}"></i> ${item.titulo}</h4>
            <p>${item.descricao}</p>
        </div>
    `).join('');

    container.innerHTML = html;
    wrapper.classList.remove('hidden');
}

function atualizarPendenciasDados(mensagens) {
    const pendenciasEl = document.getElementById('pendenciasDados');
    const pendenciasPrint = document.getElementById('printPendencias');
    if (!pendenciasEl) {
        return;
    }

    const mensagemFormatada = mensagens.length
        ? `<i class="bi bi-info-circle-fill"></i> ${mensagens.join(' · ')}`
        : '';

    if (mensagens.length) {
        pendenciasEl.innerHTML = mensagemFormatada;
        pendenciasEl.classList.remove('hidden');
        if (pendenciasPrint) {
            pendenciasPrint.innerHTML = mensagemFormatada;
            pendenciasPrint.style.display = 'block';
        }
    } else {
        pendenciasEl.classList.add('hidden');
        pendenciasEl.innerHTML = '';
        if (pendenciasPrint) {
            pendenciasPrint.style.display = 'none';
            pendenciasPrint.innerHTML = '';
        }
    }
}

function atualizarCardResultado(elementId, valorFormatado, deveMostrar = true) {
    const elemento = document.getElementById(elementId);
    if (!elemento) {
        return;
    }

    const card = elemento.closest('.result-card');
    if (deveMostrar) {
        elemento.textContent = valorFormatado;
        card?.classList.remove('hidden-card');
    } else {
        elemento.textContent = '—';
        card?.classList.add('hidden-card');
    }
}

function atualizarResumoImpressao(elementId, valorFormatado, deveMostrar = true) {
    const elemento = document.getElementById(elementId);
    if (!elemento) {
        return;
    }

    const bloco = elemento.closest('.print-summary-item');
    if (deveMostrar) {
        elemento.textContent = valorFormatado;
        bloco?.classList.remove('hidden-card');
    } else {
        elemento.textContent = '—';
        bloco?.classList.add('hidden-card');
    }
}

function validarEntradas(campos) {
    const erros = [];
    const anoAtual = new Date().getFullYear();
    const parcelasRestantesBase = Math.max(campos.totalParcelas - campos.parcelasPagas, 0);

    if (campos.totalParcelas <= 0) {
        erros.push('Informe o total de parcelas contratadas.');
    }

    if (campos.valorParcela <= 0) {
        erros.push('Informe o valor unitário da parcela.');
    }

    if (campos.parcelasPagas < 0) {
        erros.push('Parcelas pagas não podem ser negativas.');
    }

    if (campos.parcelasPagas > campos.totalParcelas) {
        erros.push('Parcelas pagas não podem exceder o total contratado.');
    }

    if (campos.parcelasAtraso < 0) {
        erros.push('Parcelas em atraso não podem ser negativas.');
    }

    if (campos.parcelasAtraso > parcelasRestantesBase) {
        erros.push('Quantidade de parcelas em atraso não pode ser maior do que as parcelas em aberto.');
    }

    if (campos.teveEntrada && campos.valorEntrada <= 0) {
        erros.push('Informe o valor da entrada ou desmarque a opção correspondente.');
    }

    if (!campos.teveEntrada && campos.valorEntrada > 0) {
        erros.push('Marque que houve entrada para considerar o valor informado.');
    }

    if (campos.valorBem < 0) {
        erros.push('Valor do bem não pode ser negativo.');
    }

    if (campos.saldoBanco < 0) {
        erros.push('Saldo informado junto ao banco não pode ser negativo.');
    }

    if (campos.anoVeiculo && (campos.anoVeiculo < 1980 || campos.anoVeiculo > anoAtual + 1)) {
        erros.push('Ano do veículo parece inconsistente.');
    }

    return erros;
}

function calcularAnalise() {
    // Obter valores dos inputs
    const nomeCliente = document.getElementById('nomeCliente').value.trim();
    const nomeConsultor = document.getElementById('nomeConsultor').value.trim();
    const valorBem = parseFloat(document.getElementById('valorBem').value) || 0;
    const anoVeiculo = parseInt(document.getElementById('anoVeiculo').value) || null;
    const saldoBancoInput = parseFloat(document.getElementById('saldoBanco').value) || 0;
    const totalParcelas = parseInt(document.getElementById('totalParcelas').value) || 0;
    const parcelasPagas = parseInt(document.getElementById('parcelasPagas').value) || 0;
    const valorParcela = parseFloat(document.getElementById('valorParcela').value) || 0;
    const parcelasAtraso = parseInt(document.getElementById('parcelasAtraso').value) || 0;
    const valorEntrada = parseFloat(document.getElementById('valorEntrada').value) || 0;
    const teveEntrada = document.getElementById('teveEntrada').checked;
    const tipoFinanciamento = document.getElementById('tipoFinanciamento').value;

    const mapaTipos = {
        veiculo: 'Veículo',
        imovel: 'Imóvel',
        maquinario: 'Maquinário',
        outros: 'Outros'
    };

    const temValorBem = valorBem > 0;
    const temAnoVeiculo = Boolean(anoVeiculo);
    // Depreciação removida: não usamos mais estimativas automáticas
    const temDepreciacao = false;
    const pendenciasGuiadas = [];

    if (!temValorBem) {
        pendenciasGuiadas.push('Informe o valor de referência do bem para liberar GAP e depreciação.');
    }
    if (temValorBem && !temAnoVeiculo) {
        pendenciasGuiadas.push('Ano do veículo não informado — usamos o valor preenchido sem ajustes.');
    }

    const erros = validarEntradas({
        totalParcelas,
        valorParcela,
        parcelasPagas,
        parcelasAtraso,
        teveEntrada,
        valorEntrada,
        valorBem,
        saldoBanco: saldoBancoInput,
        anoVeiculo
    });

    if (erros.length > 0) {
        // Não interrompemos com alert modal; registramos pendências e avisamos no console
        console.warn('Entradas inválidas detectadas:', erros);
        atualizarPendenciasDados(erros.concat(pendenciasGuiadas));
        return;
    }

    // Cálculos
    const valorTotalFinanciamento = totalParcelas * valorParcela;
    const valorTotalPago = (parcelasPagas * valorParcela) + (teveEntrada ? valorEntrada : 0);
    const valorContratadoTotal = valorTotalFinanciamento + (teveEntrada ? valorEntrada : 0);
    const parcelasRestantes = totalParcelas - parcelasPagas;
    const valorDividaRestante = parcelasRestantes * valorParcela;
    const valorAtrasoBase = parcelasAtraso * valorParcela;
    // Encargos/juros/multa removidos: mostramos apenas a base de parcelas em atraso
    const valorEncargosAtraso = 0;
    const valorAtraso = valorAtrasoBase;
    const percentualPagoBase = valorContratadoTotal > 0 ? (valorTotalPago / valorContratadoTotal) * 100 : 0;
    const percentualPagoReal = Math.min(Math.max(percentualPagoBase, 0), 100);
    const percentualPago = percentualPagoReal.toFixed(1);

    // Cenários de acordo
    // Depreciação removida: usamos o valor do bem informado como referência
    const valorBemAtualEstimado = valorBem;
    const percentualDepreciacao = 0;

    const saldoBancoConsiderado = saldoBancoInput > 0 ? saldoBancoInput : valorDividaRestante;
    const valorBemComparativo = temValorBem ? valorBem : 0;
    const diferencaSaldoValorBem = temValorBem ? saldoBancoConsiderado - valorBemComparativo : 0;
    const exposicaoRealCliente = Math.max(saldoBancoConsiderado - valorTotalPago, 0);

    const { conservador: percentualConservadorBase, agressivo: percentualAgressivoBase } = definirPercentuaisDesconto(
        percentualPagoReal,
        diferencaSaldoValorBem,
        parcelasAtraso
    );

    let percentualConservador = ajustarPercentualAcordo(percentualConservadorBase, 0.5, 0.7);
    let percentualAgressivo = ajustarPercentualAcordo(
        Math.max(percentualAgressivoBase, percentualConservador + 0.05),
        Math.max(percentualConservador + 0.05, 0.6),
        0.8
    );

    if (percentualAgressivo <= percentualConservador) {
        percentualAgressivo = Math.min(0.8, percentualConservador + 0.05);
    }

    atualizarPendenciasDados(pendenciasGuiadas);

    // Avisos defensivos para analistas/vendedores — apenas no console
    if (saldoBancoConsiderado <= 0) {
        console.warn('Saldo considerado é zero ou não informado — verifique se deseja usar o saldo do banco.');
    }
    if (Math.abs(saldoBancoConsiderado - valorDividaRestante) > Math.max(20000, valorDividaRestante * 0.5)) {
        console.warn('Diferença significativa entre saldo informado e dívida restante:', {
            saldoBancoConsiderado,
            valorDividaRestante,
            diferenca: saldoBancoConsiderado - valorDividaRestante
        });
    }

    const cenario1Economia = saldoBancoConsiderado * percentualConservador;
    const cenario1Proposta = saldoBancoConsiderado - cenario1Economia;

    const cenario2Economia = saldoBancoConsiderado * percentualAgressivo;
    const cenario2Proposta = saldoBancoConsiderado - cenario2Economia;
    const cenario2Parcela = cenario2Proposta / 18;

    // Atualizar resultados na tela
    document.getElementById('valorTotalPago').textContent = formatarMoeda(valorTotalPago);
    document.getElementById('valorDividaRestante').textContent = formatarMoeda(valorDividaRestante);
    document.getElementById('percentualPago').textContent = percentualPago + '%';
    document.getElementById('valorAtraso').textContent = formatarMoeda(valorAtraso);
    // Encargos removidos: não exibimos juros/multas
    document.getElementById('valorEncargosAtraso').textContent = '—';
    document.getElementById('parcelasRestantes').textContent = parcelasRestantes;
    document.getElementById('valorTotalFinanciamento').textContent = formatarMoeda(valorTotalFinanciamento);
    const saldoBancoEl = document.getElementById('saldoBancoResultado');
    if (saldoBancoEl) {
        saldoBancoEl.textContent = formatarMoeda(saldoBancoConsiderado);
    }
    atualizarCardResultado('valorBemBase', formatarMoeda(valorBem), temValorBem);
    atualizarCardResultado('valorBemAtual', formatarMoeda(valorBemAtualEstimado), temValorBem);
    // Depreciação não apresentada
    atualizarCardResultado('percentualDepreciacao', '—', false);
    atualizarCardResultado('gapSaldoValorBem', formatarMoeda(diferencaSaldoValorBem), temValorBem);
    document.getElementById('exposicaoCliente').textContent = formatarMoeda(exposicaoRealCliente);

    // Cenário 1 (50% desconto)
    document.getElementById('cenario1Percentual').textContent = Math.round(percentualConservador * 100) + '% de Desconto';
    document.getElementById('cenario1Original').textContent = formatarMoeda(saldoBancoConsiderado);
    document.getElementById('cenario1Desconto').textContent = formatarMoeda(cenario1Proposta);
    document.getElementById('cenario1Economia').textContent = formatarMoeda(cenario1Economia);

    // Cenário 2 (80% desconto)
    document.getElementById('cenario2Percentual').textContent = Math.round(percentualAgressivo * 100) + '% de Desconto';
    document.getElementById('cenario2Original').textContent = formatarMoeda(saldoBancoConsiderado);
    document.getElementById('cenario2Desconto').textContent = formatarMoeda(cenario2Proposta);
    document.getElementById('cenario2Economia').textContent = formatarMoeda(cenario2Economia);
    document.getElementById('cenario2Parcela').textContent = formatarMoeda(cenario2Parcela);

    // Atualizar cabeçalho e resumo para impressão
    const dataAtual = new Date();
    const dataRelatorio = dataAtual.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaRelatorio = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const clienteLabel = nomeCliente || 'Cliente não informado';
    const consultorLabel = nomeConsultor || 'Consultor não informado';
    const tipoLabel = mapaTipos[tipoFinanciamento] || 'Não informado';

    document.getElementById('printCliente').textContent = clienteLabel;
    document.getElementById('printClienteResumo').textContent = clienteLabel;
    document.getElementById('printConsultor').textContent = consultorLabel;
    document.getElementById('printData').textContent = `${dataRelatorio} às ${horaRelatorio}`;
    document.getElementById('printTipo').textContent = tipoLabel;
    document.getElementById('printTotalParcelas').textContent = totalParcelas;
    document.getElementById('printParcelasPagas').textContent = parcelasPagas;
    document.getElementById('printParcelasAtraso').textContent = parcelasAtraso;
    document.getElementById('printValorParcela').textContent = formatarMoeda(valorParcela);
    document.getElementById('printEntradaStatus').textContent = teveEntrada ? 'Sim' : 'Não';
    document.getElementById('printValorEntrada').textContent = teveEntrada && valorEntrada > 0 ? formatarMoeda(valorEntrada) : '—';
    atualizarResumoImpressao('printValorBemBase', formatarMoeda(valorBem), temValorBem);
    document.getElementById('printAnoKm').textContent = anoVeiculo
        ? `${anoVeiculo}`
        : '—';
    document.getElementById('printSaldoBanco').textContent = saldoBancoInput > 0 ? formatarMoeda(saldoBancoInput) : formatarMoeda(valorDividaRestante);

    document.getElementById('printResumoTotalPago').textContent = formatarMoeda(valorTotalPago);
    document.getElementById('printResumoDivida').textContent = formatarMoeda(valorDividaRestante);
    document.getElementById('printResumoPercentual').textContent = percentualPago + '%';
    document.getElementById('printResumoAtraso').textContent = `${formatarMoeda(valorAtrasoBase)}`;
    document.getElementById('printEncargosAtraso').textContent = '—';
    document.getElementById('printResumoParcelasRestantes').textContent = parcelasRestantes;
    document.getElementById('printResumoTotalFinanciamento').textContent = formatarMoeda(valorContratadoTotal);
    document.getElementById('printResumoCenario1').textContent = `${formatarMoeda(cenario1Proposta)} (${Math.round(percentualConservador * 100)}% desc.)`;
    document.getElementById('printResumoCenario2').textContent = `${formatarMoeda(cenario2Proposta)} (${Math.round(percentualAgressivo * 100)}% desc. / 18x ${formatarMoeda(cenario2Parcela)})`;
    atualizarResumoImpressao('printValorBemAtual', formatarMoeda(valorBemAtualEstimado), temValorBem);
    atualizarResumoImpressao('printDepreciacaoResumo', '—', false);
    atualizarResumoImpressao('printGapSaldoBem', formatarMoeda(diferencaSaldoValorBem), temValorBem);
    document.getElementById('printExposicaoCliente').textContent = formatarMoeda(exposicaoRealCliente);

    const insights = gerarInsightsJuridicos({
        percentualPago: percentualPagoReal,
        diferencaSaldoValorBem,
        temValorBem,
        valorEncargosAtraso,
        parcelasAtraso,
        exposicaoRealCliente,
        valorTotalPago,
        saldoBanco: saldoBancoConsiderado,
        valorBemComparativo,
        tipoFinanciamento
    });

    atualizarFundamentacaoDinamica(insights);

    // Mostrar seções de resultados
    document.getElementById('resultados').classList.remove('hidden');
    document.getElementById('fundamentacao').classList.remove('hidden');
    document.getElementById('cenarios').classList.remove('hidden');
    document.getElementById('diferenciais').classList.remove('hidden');
    document.getElementById('acoes').classList.remove('hidden');

    // Scroll suave para os resultados
    document.getElementById('resultados').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function imprimirAnalise() {
    const resultadosVisiveis = !document.getElementById('resultados').classList.contains('hidden');

    if (!resultadosVisiveis) {
        alert('Realize a análise antes de gerar o PDF.');
        return;
    }

    window.print();
}

function copiarUrl() {
    const urlBase = window.location.origin + window.location.pathname;

    const nomeCliente = document.getElementById('nomeCliente').value;
    const nomeConsultor = document.getElementById('nomeConsultor').value;
    const valorBem = document.getElementById('valorBem').value;
    const anoVeiculo = document.getElementById('anoVeiculo').value;
    const saldoBanco = document.getElementById('saldoBanco').value;
    const totalParcelas = document.getElementById('totalParcelas').value;
    const parcelasPagas = document.getElementById('parcelasPagas').value;
    const valorParcela = document.getElementById('valorParcela').value;
    const parcelasAtraso = document.getElementById('parcelasAtraso').value;
    const valorEntrada = document.getElementById('valorEntrada').value;
    const teveEntrada = document.getElementById('teveEntrada').checked;
    const tipoFinanciamento = document.getElementById('tipoFinanciamento').value;

    const params = new URLSearchParams({
        nomeCliente,
        nomeConsultor,
        valorBem,
        anoVeiculo,
        saldoBanco,
        totalParcelas,
        parcelasPagas,
        valorParcela,
        parcelasAtraso,
        valorEntrada,
        teveEntrada,
        tipoFinanciamento
    });

    const urlFinal = `${urlBase}?${params.toString()}`;

    // Copiar para área de transferência
    navigator.clipboard.writeText(urlFinal).then(() => {
        alert("URL copiada para a área de transferência!");
    }).catch(() => {
        alert("Erro ao copiar a URL.");
    });
}


// Animação de entrada
window.addEventListener('load', function () {
    const sections = document.querySelectorAll('.section, .header');
    sections.forEach((section, index) => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(50px)';
        setTimeout(() => {
            section.style.transition = 'all 0.6s ease';
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
        }, index * 200);
    });
});