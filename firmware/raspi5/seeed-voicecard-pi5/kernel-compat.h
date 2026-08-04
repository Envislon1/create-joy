/*
 * kernel-compat.h - ALSA SoC API shims for the Seeed Voicecard drivers.
 *
 * Lets the AC108 / AC101 / WM8960 / seeed-voicecard sources build on
 * modern kernels (tested against Linux 6.12 - 6.18, Raspberry Pi OS
 * Trixie on the Raspberry Pi 5) while still compiling on older trees.
 */
#ifndef __SEEED_KERNEL_COMPAT_H__
#define __SEEED_KERNEL_COMPAT_H__

#include <linux/version.h>
#include <linux/kernel.h>
#include <linux/device.h>
#include <linux/i2c.h>
#include <linux/interrupt.h>
#include <linux/stdarg.h>
#include <sound/soc.h>
#include <sound/soc-dai.h>

/* ------------------------------------------------------------------
 * snd_soc_pcm_runtime helpers
 *   v6.5: asoc_rtd_to_cpu()/asoc_rtd_to_codec() -> snd_soc_rtd_to_*()
 *   v6.4: rtd->num -> rtd->id
 * ------------------------------------------------------------------ */
#ifndef asoc_rtd_to_cpu
#define asoc_rtd_to_cpu(rtd, n)		snd_soc_rtd_to_cpu(rtd, n)
#define asoc_rtd_to_codec(rtd, n)	snd_soc_rtd_to_codec(rtd, n)
#endif

#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,4,0)
#define seeed_rtd_num(rtd)		((rtd)->id)
#else
#define seeed_rtd_num(rtd)		((rtd)->num)
#endif

/* v6.5: dai_link->params/num_params -> c2c_params/num_c2c_params */
#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,5,0)
#define seeed_dai_link_set_params(link, p)	\
	do { (link)->c2c_params = (p); (link)->num_c2c_params = 1; } while (0)
#else
#define seeed_dai_link_set_params(link, p)	\
	do { (link)->params = (p); (link)->num_params = 1; } while (0)
#endif

/* v5.11: dai->stream_active[] -> snd_soc_dai_stream_active() */
#if LINUX_VERSION_CODE < KERNEL_VERSION(5,11,0)
#define snd_soc_dai_stream_active(dai, stream)	((dai)->stream_active[stream])
#endif

/* v5.10 renamed in_irq() -> in_hardirq(); in_irq() removed in v6.10 */
#ifndef in_hardirq
#define in_hardirq()			in_irq()
#endif

/* ------------------------------------------------------------------
 * DAI clock provider/consumer naming (old CBM/CBS names were removed)
 * ------------------------------------------------------------------ */
#ifndef SND_SOC_DAIFMT_CBP_CFP
#define SND_SOC_DAIFMT_CBP_CFP		SND_SOC_DAIFMT_CBM_CFM
#define SND_SOC_DAIFMT_CBC_CFP		SND_SOC_DAIFMT_CBS_CFM
#define SND_SOC_DAIFMT_CBP_CFC		SND_SOC_DAIFMT_CBM_CFS
#define SND_SOC_DAIFMT_CBC_CFC		SND_SOC_DAIFMT_CBS_CFS
#endif

/* ------------------------------------------------------------------
 * SOC_SINGLE_VALUE() gained an xmin argument.  The AC108 controls abuse
 * the xautodisable slot to carry the chip index, so keep that behaviour.
 * ------------------------------------------------------------------ */
#if LINUX_VERSION_CODE >= KERNEL_VERSION(5,13,0)
#define SEEED_SOC_SINGLE_VALUE(xreg, xshift, xmax, xinvert, xautodisable) \
	SOC_SINGLE_VALUE(xreg, xshift, 0, xmax, xinvert, xautodisable)
#else
#define SEEED_SOC_SINGLE_VALUE(xreg, xshift, xmax, xinvert, xautodisable) \
	SOC_SINGLE_VALUE(xreg, xshift, xmax, xinvert, xautodisable)
#endif

/* ------------------------------------------------------------------
 * i2c_driver::probe lost its i2c_device_id argument in v6.3/v6.6
 * ------------------------------------------------------------------ */
#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,3,0)
#define SEEED_I2C_PROBE_ARGS(client)	struct i2c_client *client
#define SEEED_I2C_PROBE_ID(client)	i2c_client_get_device_id(client)
#else
#define SEEED_I2C_PROBE_ARGS(client)	struct i2c_client *client, const struct i2c_device_id *__unused_id
#define SEEED_I2C_PROBE_ID(client)	__unused_id
#endif

/* platform_driver::remove returns void since v6.11 */
#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,11,0)
#define SEEED_PLATFORM_REMOVE_RET	void
#define seeed_platform_remove_return(x)	do { (void)(x); return; } while (0)
#else
#define SEEED_PLATFORM_REMOVE_RET	int
#define seeed_platform_remove_return(x)	return (x)
#endif

/* ------------------------------------------------------------------
 * simple_card_utils: asoc_simple_* was renamed simple_util_* in v6.7
 * ------------------------------------------------------------------ */
#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,7,0)
#define asoc_simple_dai			simple_util_dai
#define asoc_simple_parse_clk		simple_util_parse_clk
#define asoc_simple_canonicalize_cpu	simple_util_canonicalize_cpu
#define asoc_simple_canonicalize_platform simple_util_canonicalize_platform
#define asoc_simple_clean_reference	simple_util_clean_reference
#endif

/*
 * Local replacements for asoc_simple_parse_daifmt() and
 * asoc_simple_set_dailink_name(): both are either gone or now require a
 * struct simple_util_priv that this card driver does not use.
 */
static inline int seeed_parse_daifmt(struct device *dev,
				     struct device_node *node,
				     struct device_node *codec,
				     char *prefix,
				     unsigned int *retfmt)
{
	struct device_node *bitclkmaster = NULL, *framemaster = NULL;
	unsigned int daifmt;

	daifmt = snd_soc_daifmt_parse_format(node, prefix);
	snd_soc_daifmt_parse_clock_provider_as_phandle(node, prefix,
						       &bitclkmaster,
						       &framemaster);
	if (!bitclkmaster && !framemaster) {
		/* No master specified: take the flags as they are. */
		daifmt |= snd_soc_daifmt_parse_clock_provider_as_flag(node, prefix);
	} else {
		daifmt |= snd_soc_daifmt_clock_provider_from_bitmap(
				((codec == bitclkmaster) << 4) |
				 (codec == framemaster));
	}

	of_node_put(bitclkmaster);
	of_node_put(framemaster);

	*retfmt = daifmt;
	return 0;
}

__printf(3, 4)
static inline int seeed_set_dailink_name(struct device *dev,
					 struct snd_soc_dai_link *dai_link,
					 const char *fmt, ...)
{
	va_list ap;
	char *name;

	va_start(ap, fmt);
	name = devm_kvasprintf(dev, GFP_KERNEL, fmt, ap);
	va_end(ap);

	if (!name)
		return -ENOMEM;

	dai_link->name = name;
	dai_link->stream_name = name;
	return 0;
}

/* ------------------------------------------------------------------
 * snd_soc_of_get_dai_name() gained an `index` argument in v6.7
 * ------------------------------------------------------------------ */
#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,7,0)
#define seeed_of_get_dai_name(node, name)	snd_soc_of_get_dai_name(node, name, 0)
#else
#define seeed_of_get_dai_name(node, name)	snd_soc_of_get_dai_name(node, name)
#endif

/*
 * asoc_simple_parse_card_name() became simple_util_parse_card_name() in
 * v6.7 and now takes a struct simple_util_priv this driver does not use,
 * so provide a local equivalent that works on every kernel.
 */
static inline int seeed_parse_card_name(struct snd_soc_card *card,
					char *prefix)
{
	int ret;

	ret = snd_soc_of_parse_card_name(card, "label");
	if (ret < 0 || !card->name) {
		char prop[128];

		snprintf(prop, sizeof(prop), "%sname", prefix ? prefix : "");
		ret = snd_soc_of_parse_card_name(card, prop);
		if (ret < 0)
			return ret;
	}

	if (!card->name && card->dai_link)
		card->name = card->dai_link->name;

	return 0;
}

#endif /* __SEEED_KERNEL_COMPAT_H__ */
