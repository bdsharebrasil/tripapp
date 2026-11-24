import { useColors } from "@/hooks/useColors";
import { Icon } from "@/src/components/ui";
import { Text, View } from "react-native";
import { styles } from "./estilos";
import {
  MaintenanceReport,
  formatDate,
  severityInfo,
  statusInfo,
} from "./modelo";

export function ReportCard({
  report,
  colors,
}: {
  report: MaintenanceReport;
  colors: ReturnType<typeof useColors>;
}) {
  const severity = severityInfo[report.severity];
  const status = statusInfo[report.status];
  return (
    <View
      style={[
        styles.reportCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: severity.color,
        },
      ]}
    >
      <View style={styles.reportTop}>
        <View style={styles.badges}>
          <Text
            style={[
              styles.badge,
              { color: severity.color, backgroundColor: severity.bg },
            ]}
          >
            {severity.label}
          </Text>
          <Text
            style={[
              styles.badge,
              { color: status.color, backgroundColor: status.bg },
            ]}
          >
            {status.label}
          </Text>
        </View>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {formatDate(report.report_date)}
        </Text>
      </View>
      <Text style={[styles.description, { color: colors.foreground }]}>
        {report.description}
      </Text>
      {report.reporter?.full_name ? (
        <View style={styles.reporter}>
          <Icon name="user" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {report.reporter.full_name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
