<script>
  import Header from "./UI/Header.svelte";
  import MeetupGrid from "./Meetups/MeetupGrid.svelte";
  import TextInput from './UI/TextInput.svelte'
  let title = "";
  let subtitle = "";
  let address = "";
  let email = "";
  let description = "";
  let imageUrl = "";
  let meetUps = [
    {
      id: "m1",
      title: "Coding Bootcamp",
      subtitle: "Learn to code in 2 hours",
      description:
        "In this meetup, we will have some experts that can teach you how to code",
      imageUrl:
        "https://images.freeimages.com/images/large-previews/c43/home-1257617.jpg",
      address: "27th Nerd Road, 48342 Michigan",
      contactEmail: "code@test.com"
    },
    {
      id: "m2",
      title: "Swimming",
      subtitle: "Let's go for a swim",
      description: "In this meet up we will learn how to swim",
      imageUrl:
        "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NHx8cG9vbHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=1000&q=60",
      address: "27th Nerd Road, 48342 Michigan",
      contactEmail: "swim@test.com"
    }
  ];

  function addMeetup() {
    const newMeetup = {
      id: Math.random().toString(),
      title: title,
      subtitle: subtitle,
      address: address,
      description: description,
      imageUrl,
      contactEmail: email
    };
    //5.49 adding new meetups via a Form
    // meetUps.push(newMeetup);// this will not work becasue sevelt does not reconzie this as a update

    //do below
    meetUps = [...meetUps, newMeetup];
  }
</script>

<Header />
<main>
  <form on:submit|preventDefault={addMeetup}>
  <!--5.50 adding more components  -->
    <TextInput id="title" label="Title" value={title} on:input={(e) => (title = e.target.value) }/>
    <TextInput id="subtitle" label="SubTitle" value={title} on:input={(e) => title = e.target.value }/>
    <TextInput id="title" label="Title" value={title} on:input={(e) => title = e.target.value }/>
    <TextInput id="title" label="Title" value={title} on:input={(e) => title = e.target.value }/>
    <div class="form-control">
      <label for="title">Title</label>
      <input type="text" id="title" bind:value={title} />
    </div>
    <div class="form-control">
      <label for="subtitle">Subtitle</label>
      <input type="text" id="subtitle" bind:value={subtitle} />
    </div>
    <div class="form-control">
      <label for="address">Address</label>
      <input type="text" id="address" bind:value={address} />
    </div>
    <div class="form-control">
      <label for="imageUrl">Image Url</label>
      <input type="text" id="imageUrl" bind:value={imageUrl} />
    </div>
    <div class="form-control">
      <label for="email">E-Mail</label>
      <input type="email" id="email" bind:value={email} />
    </div>
    <div class="form-control">
      <label for="description">Description</label>
      <textarea id="description" rows="3" bind:value={description} />
    </div>
    <button type="submit">Save</button>
  </form>
  <MeetupGrid meetups={meetUps} />
</main>

<style>
  main {
    margin-top: 5rem;
  }
</style>
