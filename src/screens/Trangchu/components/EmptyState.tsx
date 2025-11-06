import { ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const EmptyState = () => {
  return (
    <ScrollView
      style={styles.emptyContainer}
      contentContainerStyle={styles.emptyContent}
    >
      <View style={styles.emptyIllustration}>
        <Icon
          name="close"
          size={20}
          color="#90CAF9"
          style={styles.decorIcon1}
        />
        <Icon
          name="circle-outline"
          size={14}
          color="#E3F2FD"
          style={styles.decorIcon2}
        />
        <Icon
          name="close"
          size={14}
          color="#E3F2FD"
          style={styles.decorIcon3}
        />
        <Icon
          name="circle-outline"
          size={18}
          color="#90CAF9"
          style={styles.decorIcon4}
        />
        <Icon
          name="close"
          size={18}
          color="#E3F2FD"
          style={styles.decorIcon5}
        />
        <Icon
          name="circle-outline"
          size={12}
          color="#90CAF9"
          style={styles.decorIcon6}
        />

        <View style={styles.scrollIcon}>
          <View style={styles.scrollPaper}>
            <View style={styles.scrollLine} />
            <View style={styles.scrollLine} />
            <View style={styles.scrollLine} />
            <View style={[styles.scrollLine, { width: "60%" }]} />
          </View>
          <View style={styles.scrollBottom} />
        </View>

        <View style={styles.decorDots}>
          <View style={[styles.decorDot, { opacity: 0.3 }]} />
          <View style={[styles.decorDot, { opacity: 0.5 }]} />
          <View style={styles.decorDot} />
          <View style={[styles.decorDot, { opacity: 0.5 }]} />
          <View style={[styles.decorDot, { opacity: 0.3 }]} />
        </View>
      </View>
      <Text style={styles.emptyText}>Chưa có giao dịch nào</Text>
      <Text style={styles.emptySubtext}>Nhấn nút + để thêm giao dịch mới</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIllustration: {
    width: 240,
    height: 240,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 24,
  },
  decorIcon1: { position: "absolute", top: 10, left: 20, opacity: 0.6 },
  decorIcon2: { position: "absolute", top: 20, right: 30, opacity: 0.4 },
  decorIcon3: { position: "absolute", bottom: 60, left: 15, opacity: 0.3 },
  decorIcon4: { position: "absolute", top: 50, right: 15, opacity: 0.5 },
  decorIcon5: { position: "absolute", bottom: 50, right: 25, opacity: 0.3 },
  decorIcon6: { position: "absolute", top: 80, left: 30, opacity: 0.4 },
  scrollIcon: { alignItems: "center" },
  scrollPaper: {
    width: 120,
    height: 150,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#90CAF9",
    padding: 16,
    justifyContent: "flex-start",
    shadowColor: "#2196F3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  scrollLine: {
    width: "100%",
    height: 4,
    backgroundColor: "#BBDEFB",
    marginVertical: 6,
    borderRadius: 2,
  },
  scrollBottom: {
    width: 100,
    height: 35,
    backgroundColor: "#90CAF9",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    marginTop: -12,
  },
  decorDots: { flexDirection: "row", marginTop: 20 },
  decorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#90CAF9",
    marginHorizontal: 4,
  },
  emptyText: {
    fontSize: 18,
    color: "#424242",
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtext: { fontSize: 14, color: "#9E9E9E" },
});

export default EmptyState;
