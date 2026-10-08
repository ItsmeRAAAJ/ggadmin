import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { initials } from "@/lib/format";
import { colors } from "@/theme";
import { Text } from "./Text";

export function Avatar({ uri, name, size = 48, ring }: { uri?: string | null; name: string; size?: number; ring?: boolean }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[style, styles.wrap, ring && { borderWidth: 3, borderColor: colors.white }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={uri} />
      ) : (
        <Text style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }} variant="subheading" color={colors.primaryDark}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
