<?php
/**
 * Plugin Name: Orçamento Liganer
 * Description: Área restrita para gerar, exportar e salvar orçamentos Liganer.
 * Version: 0.2.1
 * Author: Liganer
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Orcamento_Liganer_Plugin {
    const VERSION = '0.2.1';
    const CAPABILITY = 'liganer_orcamentos';

    public static function init(): void {
        add_shortcode('orcamento_liganer', [__CLASS__, 'render_shortcode']);
        add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue_assets']);
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
        add_action('admin_menu', [__CLASS__, 'register_admin_menu']);
        add_action('admin_init', [__CLASS__, 'ensure_capabilities']);
        add_action('admin_post_orcamento_liganer_export', [__CLASS__, 'handle_admin_export']);
        add_action('admin_post_orcamento_liganer_delete', [__CLASS__, 'handle_admin_delete']);
    }

    public static function activate(): void {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $table = self::table_name();
        $charset = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE {$table} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            number VARCHAR(16) NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            kind VARCHAR(32) NOT NULL DEFAULT 'orcamento',
            payload LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY number (number),
            KEY user_id (user_id),
            KEY created_at (created_at)
        ) {$charset};");

        self::ensure_capabilities();
    }

    public static function ensure_capabilities(): void {
        $admin = get_role('administrator');
        if ($admin) {
            $admin->add_cap(self::CAPABILITY);
        }
        if (!get_role('liganer_orcamentos')) {
            add_role('liganer_orcamentos', 'Orçamentos Liganer', [
                'read' => true,
                self::CAPABILITY => true,
            ]);
        }
        $role = get_role('liganer_orcamentos');
        if ($role) {
            $role->add_cap('read');
            $role->add_cap(self::CAPABILITY);
        }
    }

    public static function table_name(): string {
        global $wpdb;
        return $wpdb->prefix . 'liganer_orcamentos';
    }

    public static function register_admin_menu(): void {
        add_menu_page(
            'Orçamentos Liganer',
            'Orçamentos Liganer',
            self::CAPABILITY,
            'orcamento-liganer',
            [__CLASS__, 'render_admin_page'],
            'dashicons-media-spreadsheet',
            26
        );
    }

    public static function render_admin_page(): void {
        if (!current_user_can(self::CAPABILITY)) {
            wp_die('Usuário sem permissão para acessar os orçamentos.');
        }

        global $wpdb;
        $table = self::table_name();
        $per_page = 30;
        $paged = max(1, (int) ($_GET['paged'] ?? 1));
        $offset = ($paged - 1) * $per_page;
        $search = sanitize_text_field(wp_unslash($_GET['s'] ?? ''));
        $selected_id = absint($_GET['orcamento_id'] ?? 0);
        $export_all_url = wp_nonce_url(add_query_arg([
            'action' => 'orcamento_liganer_export',
            'format' => 'excel_geral',
            's' => $search,
        ], admin_url('admin-post.php')), 'orcamento_liganer_export_0');
        $where = '';
        $params = [];

        if ($search !== '') {
            $where = 'WHERE number LIKE %s OR payload LIKE %s';
            $like = '%' . $wpdb->esc_like($search) . '%';
            $params[] = $like;
            $params[] = $like;
        }

        $count_sql = "SELECT COUNT(*) FROM {$table} {$where}";
        $total_items = $params ? (int) $wpdb->get_var($wpdb->prepare($count_sql, $params)) : (int) $wpdb->get_var($count_sql);
        $rows_sql = "SELECT * FROM {$table} {$where} ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d";
        $records = $wpdb->get_results($wpdb->prepare($rows_sql, array_merge($params, [$per_page, $offset])));
        $selected = $selected_id ? $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $selected_id)) : null;

        echo '<div class="wrap">';
        echo '<h1>Orçamentos Liganer</h1>';
        if (!empty($_GET['deleted'])) {
            echo '<div class="notice notice-success is-dismissible"><p>Orçamento deletado.</p></div>';
        }
        echo '<form method="get" style="margin:16px 0;">';
        echo '<input type="hidden" name="page" value="orcamento-liganer" />';
        echo '<label class="screen-reader-text" for="orcamento-liganer-search">Buscar orçamento</label>';
        echo '<input id="orcamento-liganer-search" type="search" name="s" value="' . esc_attr($search) . '" placeholder="Número, modelo, cliente..." />';
        submit_button('Buscar', 'secondary', '', false);
        echo ' <a class="button button-primary" href="' . esc_url($export_all_url) . '">Relatório geral XLSX</a>';
        echo '</form>';
        echo '<table class="widefat fixed striped">';
        echo '<thead><tr><th>Número</th><th>Data</th><th>Usuário</th><th>Cliente</th><th>Modelo</th><th>Itens</th><th>Total</th><th>Ações</th></tr></thead><tbody>';

        if (!$records) {
            echo '<tr><td colspan="8">Nenhum orçamento salvo ainda.</td></tr>';
        }

        foreach ($records as $record) {
            $payload = json_decode((string) $record->payload, true);
            $user = get_userdata((int) $record->user_id);
            $model = is_array($payload) ? (string) ($payload['modelName'] ?? $payload['modelId'] ?? '') : '';
            $client = is_array($payload['client'] ?? null) ? (string) ($payload['client']['name'] ?? '') : '';
            $items = is_array($payload['rows'] ?? null) ? count($payload['rows']) : 0;
            $summary = is_array($payload['summary'] ?? null) ? $payload['summary'] : [];
            $total = isset($summary['total']) ? self::format_brl((float) $summary['total']) : '-';
            $view_url = add_query_arg([
                'page' => 'orcamento-liganer',
                'orcamento_id' => (int) $record->id,
                's' => $search,
                'paged' => $paged,
            ], admin_url('admin.php'));
            $delete_url = self::admin_delete_url((int) $record->id, $paged, $search);

            echo '<tr>';
            echo '<td><strong>' . esc_html($record->number) . '</strong></td>';
            echo '<td>' . esc_html(mysql2date('d/m/Y H:i', $record->created_at)) . '</td>';
            echo '<td>' . esc_html($user ? $user->display_name : 'Usuário #' . (int) $record->user_id) . '</td>';
            echo '<td>' . esc_html($client ?: '-') . '</td>';
            echo '<td>' . esc_html($model ?: '-') . '</td>';
            echo '<td>' . esc_html((string) $items) . '</td>';
            echo '<td>' . esc_html($total) . '</td>';
            echo '<td>';
            echo '<a class="button button-small" href="' . esc_url($view_url) . '">Ver dados</a> ';
            echo '<a class="button button-small" target="_blank" href="' . esc_url(self::admin_export_url((int) $record->id, 'pdf_cliente')) . '">PDF cliente</a> ';
            echo '<a class="button button-small" target="_blank" href="' . esc_url(self::admin_export_url((int) $record->id, 'pdf_liganer')) . '">PDF Liganer</a> ';
            echo '<a class="button button-small" href="' . esc_url(self::admin_export_url((int) $record->id, 'excel')) . '">Excel</a> ';
            echo '<a class="button button-small" href="' . esc_url(self::admin_export_url((int) $record->id, 'csv')) . '">CSV</a> ';
            echo '<a class="button button-small button-link-delete" href="' . esc_url($delete_url) . '" onclick="return confirm(\'Excluir este orçamento salvo? Esta ação não pode ser desfeita.\');">Deletar</a>';
            echo '</td>';
            echo '</tr>';
        }

        echo '</tbody></table>';

        $total_pages = max(1, (int) ceil($total_items / $per_page));
        if ($total_pages > 1) {
            echo '<div class="tablenav"><div class="tablenav-pages">';
            echo paginate_links([
                'base' => add_query_arg(['paged' => '%#%', 's' => $search, 'page' => 'orcamento-liganer'], admin_url('admin.php')),
                'format' => '',
                'current' => $paged,
                'total' => $total_pages,
            ]);
            echo '</div></div>';
        }

        if ($selected) {
            $payload = json_decode((string) $selected->payload, true);
            $pretty = is_array($payload) ? wp_json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : (string) $selected->payload;
            echo '<hr />';
            echo '<h2>Orçamento ' . esc_html($selected->number) . '</h2>';
            echo '<p><strong>Salvo em:</strong> ' . esc_html(mysql2date('d/m/Y H:i', $selected->created_at)) . '</p>';
            echo '<textarea readonly style="width:100%;min-height:420px;font-family:Consolas,monospace;">' . esc_textarea($pretty) . '</textarea>';
        }

        echo '</div>';
    }

    private static function format_brl(float $value): string {
        return 'R$ ' . number_format($value, 2, ',', '.');
    }

    private static function admin_export_url(int $record_id, string $format): string {
        return wp_nonce_url(add_query_arg([
            'action' => 'orcamento_liganer_export',
            'record_id' => $record_id,
            'format' => $format,
        ], admin_url('admin-post.php')), 'orcamento_liganer_export_' . $record_id);
    }

    private static function admin_delete_url(int $record_id, int $paged, string $search): string {
        return wp_nonce_url(add_query_arg([
            'action' => 'orcamento_liganer_delete',
            'record_id' => $record_id,
            'paged' => $paged,
            's' => $search,
        ], admin_url('admin-post.php')), 'orcamento_liganer_delete_' . $record_id);
    }

    public static function handle_admin_delete(): void {
        if (!current_user_can(self::CAPABILITY)) {
            wp_die('Usuário sem permissão para deletar orçamentos.');
        }

        $record_id = absint($_GET['record_id'] ?? 0);
        check_admin_referer('orcamento_liganer_delete_' . $record_id);

        global $wpdb;
        $wpdb->delete(self::table_name(), ['id' => $record_id], ['%d']);

        wp_safe_redirect(add_query_arg([
            'page' => 'orcamento-liganer',
            'paged' => max(1, absint($_GET['paged'] ?? 1)),
            's' => sanitize_text_field(wp_unslash($_GET['s'] ?? '')),
            'deleted' => 1,
        ], admin_url('admin.php')));
        exit;
    }

    public static function handle_admin_export(): void {
        if (!current_user_can(self::CAPABILITY)) {
            wp_die('Usuário sem permissão para exportar orçamentos.');
        }

        $record_id = absint($_GET['record_id'] ?? 0);
        $format = sanitize_key($_GET['format'] ?? '');
        check_admin_referer('orcamento_liganer_export_' . $record_id);

        if ($format === 'excel_geral') {
            self::export_general_excel(sanitize_text_field(wp_unslash($_GET['s'] ?? '')));
        }

        $record = self::get_budget_record($record_id);
        if (!$record) {
            wp_die('Orçamento não encontrado.');
        }

        $payload = json_decode((string) $record->payload, true);
        if (!is_array($payload)) {
            wp_die('Dados do orçamento inválidos.');
        }

        if ($format === 'csv') {
            self::export_csv($record, $payload);
        } elseif ($format === 'excel') {
            self::export_excel_xml($record, $payload);
        } elseif ($format === 'pdf_cliente' || $format === 'pdf_liganer') {
            self::export_printable_pdf($record, $payload, $format === 'pdf_liganer');
        }

        wp_die('Formato de exportação inválido.');
    }

    private static function get_budget_record(int $record_id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM " . self::table_name() . " WHERE id = %d", $record_id));
    }

    private static function query_budget_records(string $search = ''): array {
        global $wpdb;
        $table = self::table_name();
        if ($search !== '') {
            $like = '%' . $wpdb->esc_like($search) . '%';
            return $wpdb->get_results($wpdb->prepare("SELECT * FROM {$table} WHERE number LIKE %s OR payload LIKE %s ORDER BY created_at DESC, id DESC", $like, $like));
        }
        return $wpdb->get_results("SELECT * FROM {$table} ORDER BY created_at DESC, id DESC");
    }

    private static function export_fields(array $payload, bool $liganer): array {
        $hidden_client = [
            'fator_maximo', 'fator_utilizado', 'comissao', 'campanha',
            'preco_fator_100', 'preco_bobina_fator_100',
            'preco_servico', 'descricao_servico', '_preco_total',
            'acrescimo_perda_percentual', '_acrescimo_perda_percentual', '_acrescimo_perda_valor',
        ];
        if (is_array($payload['exportFields'] ?? null)) {
            $keys = [];
            foreach ($payload['exportFields'] as $field) {
                if (!is_array($field)) continue;
                $key = (string) ($field['key'] ?? '');
                if ($key === '' || $key === '_item' || $key === 'material' || $key === 'um') continue;
                if (!$liganer && (in_array($key, $hidden_client, true) || self::is_supplier_key($key))) continue;
                if (!in_array($key, $keys, true)) $keys[] = $key;
            }
            return $keys;
        }
        $keys = [];
        foreach (self::payload_rows($payload) as $row) {
            if (!is_array($row)) continue;
            foreach ($row as $key => $value) {
                if ($key === 'material' || $key === 'um') continue;
                if (!$liganer && (in_array($key, $hidden_client, true) || self::is_supplier_key($key))) continue;
                if (!in_array($key, $keys, true)) $keys[] = $key;
            }
        }
        return $keys;
    }

    private static function payload_rows(array $payload): array {
        if (is_array($payload['exportRows'] ?? null)) {
            return $payload['exportRows'];
        }
        return is_array($payload['rows'] ?? null) ? $payload['rows'] : [];
    }

    private static function is_supplier_key(string $key): bool {
        return (bool) preg_match('/^(ace_|filial_industria_|acos_prime_|img_|csa_|tetto_)/', $key);
    }

    private static function field_label(string $key): string {
        $labels = [
            'tipo' => 'Tipo',
            'acabamento' => 'Acabamento',
            'pvc' => 'PVC',
            'espessura' => 'Espessura',
            'largura' => 'Largura',
            'comprimento' => 'Comprimento',
            'unidade' => 'Quantidade',
            'peso_unitario' => 'Peso unitario',
            'peso_total' => 'Peso total',
            '_peso_total' => 'Peso total',
            'icms' => 'ICMS',
            'observacao' => 'Observacao',
            'preco_fator_100' => 'Preco fator 100',
            'preco_bobina_fator_100' => 'Preco bobina fator 100',
            '_preco_fator_utilizado' => 'Preco fator utilizado',
            '_preco_bobina_fator_utilizado' => 'Preco bobina fator utilizado',
            '_preco_sem_ipi' => 'Preco sem IPI',
            '_subtotal' => 'Subtotal',
            'fator_maximo' => 'Fator maximo',
            'fator_utilizado' => 'Fator utilizado',
            'tipo_bobina' => 'Tipo bobina',
            'comissao' => 'Comissao',
            'campanha' => 'Campanha',
            'largura_bobina' => 'Largura bobina',
            'peso_bobina' => 'Peso bobina',
            'preco_servico' => 'Preco servico',
            'descricao_servico' => 'Descricao servico',
            '_quantidade_cortes' => 'Quantidade de cortes',
            '_perda_mm' => 'Perda (mm)',
            '_perda_percentual' => 'Perda (%)',
            '_acrescimo_perda_percentual' => 'Acrescimo perda (%)',
            '_acrescimo_perda_valor' => 'Acrescimo perda (R$)',
            '_preco_total' => 'Preco total',
            'numero' => 'Numero',
            'data' => 'Data',
            'usuario' => 'Usuario',
            'cliente' => 'Cliente',
            'cnpj' => 'CNPJ',
            'modelo' => 'Modelo',
            'item' => 'Item',
            'material' => 'Material',
        ];
        return $labels[$key] ?? ucwords(str_replace('_', ' ', $key));
    }

    private static function material_from_payload(array $payload): string {
        $model = strtolower((string) ($payload['modelId'] ?? $payload['modelName'] ?? ''));
        if (strpos($model, 'bobina') !== false) return 'BOBINA';
        if (strpos($model, 'slitter') !== false || strpos($model, 'fita') !== false) return 'FITA';
        if (strpos($model, 'blank') !== false) return 'BLANK';
        if (strpos($model, 'tubo') !== false || strpos($model, 'barra') !== false) return 'TUBO/BARRA';
        return 'CHAPA';
    }
    private static function display_export_value($value, string $key): string {
        if (is_bool($value)) return $value ? 'X' : '';
        if (is_numeric($value) && in_array($key, ['item', '_item', 'fator_maximo', 'fator_utilizado', 'largura', 'comprimento', 'unidade'], true)) {
            return number_format((float) $value, 0, ',', '.');
        }
        if (is_numeric($value) && (strpos($key, 'preco') !== false || $key === '_subtotal' || $key === '_acrescimo_perda_valor')) {
            return self::format_brl((float) $value);
        }
        if (is_numeric($value) && strpos($key, 'percentual') !== false) {
            return number_format((float) $value * 100, 2, ',', '.') . '%';
        }
        return (string) $value;
    }
    private static function export_csv($record, array $payload): void {
        $fields = self::export_fields($payload, true);
        $client = is_array($payload['client'] ?? null) ? $payload['client'] : [];
        nocache_headers();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="orcamento-' . sanitize_file_name($record->number) . '.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, array_merge(['Cliente', 'CNPJ'], array_map([__CLASS__, 'field_label'], $fields)), ';');
        foreach (self::payload_rows($payload) as $row) {
            $line = [$client['name'] ?? '', $client['cnpj'] ?? ''];
            foreach ($fields as $field) {
                $line[] = self::display_export_value($row[$field] ?? '', $field);
            }
            fputcsv($out, $line, ';');
        }
        exit;
    }

    private static function export_excel_xml($record, array $payload): void {
        $fields = self::export_fields($payload, true);
        $client = is_array($payload['client'] ?? null) ? $payload['client'] : [];
        nocache_headers();
        header('Content-Type: application/vnd.ms-excel; charset=utf-8');
        header('Content-Disposition: attachment; filename="orcamento-' . sanitize_file_name($record->number) . '.xls"');
        echo '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
        echo '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Orcamento"><Table>';
        echo '<Row>';
        foreach (array_merge(['cliente', 'cnpj'], $fields) as $field) echo '<Cell><Data ss:Type="String">' . esc_html(self::field_label($field)) . '</Data></Cell>';
        echo '</Row>';
        foreach (self::payload_rows($payload) as $row) {
            echo '<Row>';
            echo '<Cell><Data ss:Type="String">' . esc_html((string) ($client['name'] ?? '')) . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . esc_html((string) ($client['cnpj'] ?? '')) . '</Data></Cell>';
            foreach ($fields as $field) echo '<Cell><Data ss:Type="String">' . esc_html(self::display_export_value($row[$field] ?? '', $field)) . '</Data></Cell>';
            echo '</Row>';
        }
        echo '</Table></Worksheet></Workbook>';
        exit;
    }

    private static function export_xlsx_file(string $filename, array $headers, array $rows): bool {
        if (!class_exists('ZipArchive')) {
            return false;
        }

        $tmp = tempnam(get_temp_dir(), 'liganer-xlsx-');
        if (!$tmp) {
            return false;
        }

        $zip = new ZipArchive();
        if ($zip->open($tmp, ZipArchive::OVERWRITE) !== true) {
            @unlink($tmp);
            return false;
        }

        $escape = static function ($value): string {
            return htmlspecialchars((string) $value, ENT_XML1 | ENT_COMPAT, 'UTF-8');
        };
        $col = static function (int $index): string {
            $letters = '';
            while ($index >= 0) {
                $letters = chr(($index % 26) + 65) . $letters;
                $index = intdiv($index, 26) - 1;
            }
            return $letters;
        };
        $sheet_rows = array_merge([$headers], $rows);
        $sheet_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
        foreach ($sheet_rows as $row_index => $row) {
            $r = $row_index + 1;
            $sheet_xml .= '<row r="' . $r . '">';
            foreach ($row as $cell_index => $value) {
                $ref = $col($cell_index) . $r;
                $sheet_xml .= '<c r="' . $ref . '" t="inlineStr"><is><t>' . $escape($value) . '</t></is></c>';
            }
            $sheet_xml .= '</row>';
        }
        $sheet_xml .= '</sheetData></worksheet>';

        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Relatorio" sheetId="1" r:id="rId1"/></sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheet_xml);
        $zip->close();

        nocache_headers();
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . sanitize_file_name($filename) . '"');
        header('Content-Length: ' . filesize($tmp));
        readfile($tmp);
        @unlink($tmp);
        return true;
    }

    private static function export_general_excel(string $search = ''): void {
        $records = self::query_budget_records($search);
        $base_fields = ['numero', 'data', 'usuario', 'cliente', 'cnpj', 'modelo', 'item'];
        $row_fields = [];
        $prepared = [];

        foreach ($records as $record) {
            $payload = json_decode((string) $record->payload, true);
            if (!is_array($payload)) continue;
            foreach (self::payload_rows($payload) as $index => $row) {
                if (!is_array($row)) continue;
                foreach ($row as $key => $value) {
                    if ($key === 'material' || $key === 'um') continue;
                    if (!in_array($key, $row_fields, true)) $row_fields[] = $key;
                }
                $prepared[] = [$record, $payload, $index, $row];
            }
        }

        $headers = array_map([__CLASS__, 'field_label'], array_merge($base_fields, $row_fields));
        $xlsx_rows = [];
        foreach ($prepared as [$record, $payload, $index, $row]) {
            $user = get_userdata((int) $record->user_id);
            $client = is_array($payload['client'] ?? null) ? $payload['client'] : [];
            $base_values = [
                $record->number,
                mysql2date('d/m/Y H:i', $record->created_at),
                $user ? $user->display_name : 'Usuário #' . (int) $record->user_id,
                $client['name'] ?? '',
                $client['cnpj'] ?? '',
                $payload['modelName'] ?? $payload['modelId'] ?? '',
                $index + 1,
            ];
            $xlsx_row = array_map('strval', $base_values);
            foreach ($row_fields as $field) {
                $xlsx_row[] = self::display_export_value($row[$field] ?? '', $field);
            }
            $xlsx_rows[] = $xlsx_row;
        }

        if (self::export_xlsx_file('relatorio-geral-orcamentos-liganer.xlsx', $headers, $xlsx_rows)) {
            exit;
        }

        nocache_headers();
        header('Content-Type: application/vnd.ms-excel; charset=utf-8');
        header('Content-Disposition: attachment; filename="relatorio-geral-orcamentos-liganer.xls"');
        echo '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
        echo '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Relatorio"><Table>';
        echo '<Row>';
        foreach ($headers as $header) {
            echo '<Cell><Data ss:Type="String">' . esc_html($header) . '</Data></Cell>';
        }
        echo '</Row>';
        foreach ($xlsx_rows as $xlsx_row) {
            echo '<Row>';
            foreach ($xlsx_row as $value) echo '<Cell><Data ss:Type="String">' . esc_html((string) $value) . '</Data></Cell>';
            echo '</Row>';
        }
        echo '</Table></Worksheet></Workbook>';
        exit;
    }

    private static function export_printable_pdf($record, array $payload, bool $liganer): void {
        $fields = self::export_fields($payload, $liganer);
        $summary = is_array($payload['summary'] ?? null) ? $payload['summary'] : [];
        $conditions = is_array($payload['conditions'] ?? null) ? $payload['conditions'] : [];
        $client = is_array($payload['client'] ?? null) ? $payload['client'] : [];
        nocache_headers();
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html><head><meta charset="utf-8"><title>Orçamento ' . esc_html($record->number) . '</title>';
        echo '<style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{color:#C60000}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ccc;padding:5px;text-align:center;white-space:nowrap}th{background:#fde7e7}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.box{border:1px solid #ccc;padding:10px}.box div{border-bottom:1px solid #ddd;padding:6px 0}@media print{button{display:none}}</style>';
        echo '</head><body><button onclick="window.print()">Salvar em PDF</button>';
        echo '<h1>Orçamento Liganer</h1><p><strong>Número:</strong> ' . esc_html($record->number) . ' &nbsp; <strong>Modelo:</strong> ' . esc_html((string) ($payload['modelName'] ?? '')) . ' &nbsp; <strong>Cliente:</strong> ' . esc_html((string) ($client['name'] ?? '-')) . ' &nbsp; <strong>CNPJ:</strong> ' . esc_html((string) ($client['cnpj'] ?? '-')) . '</p>';
        echo '<table><thead><tr><th>Item</th><th>Material</th>';
        foreach ($fields as $field) echo '<th>' . esc_html(self::field_label($field)) . '</th>';
        echo '</tr></thead><tbody>';
        foreach (self::payload_rows($payload) as $index => $row) {
            echo '<tr><td>' . esc_html(self::display_export_value($index + 1, 'item')) . '</td>';
            $material = is_array($row) ? (string) ($row['material'] ?? '') : '';
            if ($material === '') $material = self::material_from_payload($payload);
            echo '<td>' . esc_html($material) . '</td>';
            foreach ($fields as $field) echo '<td>' . esc_html(self::display_export_value($row[$field] ?? '', $field)) . '</td>';
            echo '</tr>';
        }
        echo '</tbody></table><div class="grid"><div class="box"><h2>Totais</h2>';
        foreach (['totalKg' => 'Total (Kg)', 'subtotal' => 'Subtotal', 'ipi' => 'IPI 3,25%', 'total' => 'Total'] as $key => $label) {
            if (isset($summary[$key])) echo '<div><strong>' . esc_html($label) . ':</strong> ' . esc_html($key === 'totalKg' ? number_format((float) $summary[$key], 2, ',', '.') . ' Kg' : self::format_brl((float) $summary[$key])) . '</div>';
        }
        echo '</div><div class="box"><h2>Condições</h2>';
        foreach ($conditions as $key => $value) {
            if ($value === '' || $value === null) continue;
            echo '<div><strong>' . esc_html(self::field_label((string) $key)) . ':</strong> ' . esc_html((string) $value) . '</div>';
        }
        echo '</div></div><script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)})</script></body></html>';
        exit;
    }

    public static function enqueue_assets(): void {
        if (!is_singular()) return;
        global $post;
        if (!$post || !has_shortcode((string) $post->post_content, 'orcamento_liganer')) return;

        $base = plugin_dir_url(__FILE__) . 'assets/';
        $assets_dir = plugin_dir_path(__FILE__) . 'assets/';
        $css_version = file_exists($assets_dir . 'styles.css') ? (string) filemtime($assets_dir . 'styles.css') : self::VERSION;
        $js_version = file_exists($assets_dir . 'app.js') ? (string) filemtime($assets_dir . 'app.js') : self::VERSION;

        wp_enqueue_style('orcamento-liganer', $base . 'styles.css', [], $css_version);
        wp_enqueue_script('sheetjs', 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', [], '0.20.3', true);
        wp_enqueue_script('orcamento-liganer', $base . 'app.js', ['sheetjs'], $js_version, true);
        wp_localize_script('orcamento-liganer', 'ORCAMENTO_LIGANER_API', [
            'nonce' => wp_create_nonce('wp_rest'),
            'saveBudgetUrl' => rest_url('orcamento-liganer/v1/budgets'),
            'printNumberUrl' => rest_url('orcamento-liganer/v1/print-number'),
            'currentUser' => [
                'id' => get_current_user_id(),
                'name' => wp_get_current_user()->display_name,
            ],
        ]);
    }

    public static function render_shortcode(): string {
        if (!is_user_logged_in()) {
            return '<div class="orcamento-liganer-login">' . wp_login_form([
                'echo' => false,
                'redirect' => get_permalink(),
            ]) . '</div>';
        }
        if (!current_user_can(self::CAPABILITY)) {
            return '<p>Usuário sem permissão para acessar os orçamentos.</p>';
        }

        ob_start();
        ?>
        <main class="shell orcamento-liganer-app">
          <header class="topbar">
            <div><p class="eyebrow">Orçamento Liganer</p><h1>Preenchimento por voz</h1></div>
            <button id="settingsButton" class="icon-button" type="button" aria-label="Configurar modelo" title="Configurar modelo">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 0 1-4 0v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3a2 2 0 0 1 4 0v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.37 9c.25.62.85 1 1.56 1H21a2 2 0 0 1 0 4h-.08c-.71 0-1.31.38-1.56 1Z" /></svg>
            </button>
          </header>
          <section class="client-panel" aria-label="Cliente"><label for="clientNameInput">Nome do cliente</label><input id="clientNameInput" type="text" autocomplete="organization" /><label for="clientCnpjInput">CNPJ</label><input id="clientCnpjInput" type="text" inputmode="numeric" autocomplete="off" /></section>
          <section class="model-panel" aria-label="Modelo"><label for="modelSelect">Modelo</label><select id="modelSelect"></select><p id="modelMeta" class="model-meta"></p><div id="modelNotice" class="model-notice" hidden></div></section>
          <section class="voice-panel" aria-label="Ditado dos itens">
            <button id="micButton" class="mic-button" type="button"><span class="mic-glyph"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" /><path d="M19 11a7 7 0 0 1-14 0" /><path d="M12 18v3" /><path d="M8 21h8" /></svg></span><span id="micLabel">Ditar orçamento</span></button>
            <div class="dictation-current"><span>Campo atual</span><strong id="stepStatus">Tipo</strong><div class="field-nav"><button id="prevItemFieldButton" class="secondary-button nav-button" type="button" aria-label="Campo anterior">&lt;</button><button id="nextItemFieldButton" class="secondary-button nav-button" type="button" aria-label="Proximo campo">&gt;</button></div></div>
            <textarea id="transcriptInput" hidden></textarea><button id="applyTextButton" type="button" hidden>Aplicar texto</button><button id="saveRowButton" type="button" hidden>Salvar linha</button>
          </section>
          <section class="table-panel" aria-label="Itens"><div class="section-heading"><h2>Itens</h2><button id="addItemButton" class="secondary-button" type="button">Adicionar item</button></div><div class="table-scroll"><table><thead id="tableHead"></thead><tbody id="tableBody"></tbody></table></div></section>
          <section class="summary-panel" aria-label="Totais"><div class="section-heading"><h2>Totais</h2></div><div id="summaryGrid" class="summary-grid"></div></section>
          <section class="voice-panel footer-voice-panel" aria-label="Ditado das condições">
            <button id="footerMicButton" class="mic-button" type="button"><span class="mic-glyph"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" /><path d="M19 11a7 7 0 0 1-14 0" /><path d="M12 18v3" /><path d="M8 21h8" /></svg></span><span id="footerMicLabel">Ditar condições</span></button>
            <div class="dictation-current"><span>Campo atual</span><strong id="footerStepStatus">Pagamento</strong><div class="field-nav"><button id="prevFooterFieldButton" class="secondary-button nav-button" type="button" aria-label="Campo anterior">&lt;</button><button id="nextFooterFieldButton" class="secondary-button nav-button" type="button" aria-label="Proximo campo">&gt;</button></div></div>
          </section>
          <section class="footer-panel" aria-label="Condições"><div class="section-heading"><h2>Condições</h2></div><div id="footerGrid" class="draft-grid"></div><div class="save-actions"><button id="saveBudgetButton" class="primary-button" type="button">Salvar</button><button id="exportClientPdfButton" class="secondary-button" type="button">PDF cliente</button><button id="exportLiganerPdfButton" class="secondary-button" type="button">PDF Liganer</button><button id="exportXlsxButton" class="secondary-button" type="button">Excel</button><button id="exportCsvButton" class="secondary-button" type="button">CSV</button></div></section>
          <p id="statusLine" class="status" role="status"></p>
          <dialog id="settingsDialog" class="settings-dialog"><form method="dialog" class="settings-card"><header class="dialog-header"><h2>Modelo</h2><button class="icon-button small" type="submit" aria-label="Fechar" title="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button></header><label for="columnsConfig">Configuracao JSON</label><textarea id="columnsConfig" rows="12"></textarea><div class="dialog-actions"><button id="resetColumnsButton" class="secondary-button" type="button">Restaurar</button><button id="saveColumnsButton" class="primary-button" type="button">Salvar</button></div></form></dialog>
        </main>
        <?php
        return ob_get_clean();
    }

    public static function register_routes(): void {
        register_rest_route('orcamento-liganer/v1', '/budgets', ['methods' => 'POST', 'permission_callback' => [__CLASS__, 'can_use_api'], 'callback' => [__CLASS__, 'save_budget']]);
        register_rest_route('orcamento-liganer/v1', '/print-number', ['methods' => 'POST', 'permission_callback' => [__CLASS__, 'can_use_api'], 'callback' => [__CLASS__, 'reserve_print_number']]);
    }

    public static function can_use_api(): bool {
        return is_user_logged_in() && current_user_can(self::CAPABILITY);
    }

    public static function reserve_print_number(): WP_REST_Response {
        return new WP_REST_Response(['number' => self::next_number()], 200);
    }

    public static function save_budget(WP_REST_Request $request): WP_REST_Response {
        global $wpdb;
        $payload = $request->get_json_params();
        if (!is_array($payload)) $payload = [];
        $number = self::next_number();
        $wpdb->insert(self::table_name(), [
            'number' => $number,
            'user_id' => get_current_user_id(),
            'kind' => sanitize_text_field($payload['kind'] ?? 'orcamento'),
            'payload' => wp_json_encode($payload, JSON_UNESCAPED_UNICODE),
            'created_at' => current_time('mysql'),
        ], ['%s', '%d', '%s', '%s', '%s']);
        return new WP_REST_Response(['id' => (int) $wpdb->insert_id, 'number' => $number], 201);
    }

    private static function next_number(): string {
        $stamp = current_time('ymd');
        $key = 'orcamento_liganer_counter_' . $stamp;
        $next = (int) get_option($key, 0) + 1;
        update_option($key, $next, false);
        return $stamp . str_pad((string) $next, 2, '0', STR_PAD_LEFT);
    }
}

register_activation_hook(__FILE__, ['Orcamento_Liganer_Plugin', 'activate']);
Orcamento_Liganer_Plugin::init();

