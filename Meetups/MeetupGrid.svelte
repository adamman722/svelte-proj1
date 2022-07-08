<script>
  import MeetupItem from "./MeetupItem.svelte";

  export let meetups;
</script>

<section id="meetups">
  {#each meetups as metting}
    <MeetupItem
      title={metting.title}
      subtitle={metting.subtitle}
      imageUrl={metting.imageUrl}
      description={metting.description}
      address={metting.address}
      email={metting.contactEmail}
    />
  {/each}
</section>

<style>
  section {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
    grid-gap: 1rem;
  }
  @media (min-width: 768px) {
    section {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
